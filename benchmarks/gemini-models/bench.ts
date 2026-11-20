// Gemini model benchmark on the app's real report pipeline (server/research), so prompts, checks, and the email can't
// drift from the app. One run is one full report: research call, format call, page checks, email draft.
// See README.md here before running: it costs money.
//
//   npx tsx benchmarks/gemini-models/bench.ts
//
// MODELS       comma-separated; `model@level` overrides only the research call's thinking level (default: the app's)
// CASES        case IDs from cases.ts (default: all)
// REPEATS      runs per variant and case (default 3)
// CONCURRENCY  reports in flight at once (default 3)
// BUDGET_MS    per-report limit (default 120000, so slow runs finish; the app gives up at 45 s, which summarize scores)
// OUT          results folder (default results/<today>); runs append to its results.jsonl
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import type { Investigation } from '../../shared/types';
import { ApiError } from '../../server/errors';
import { createPinnedTransport, PAGE_TIMEOUT_MS, systemResolver } from '../../server/research/fetch-page';
import { CONTEXT_WAIT_MS, runInvestigation } from '../../server/research/pipeline';
import { createEmailDraft } from '../../src/lib/email';
import { CASES, namedOffice, type BenchCase, type CallRecord, type RawResponse, type RunRow } from './cases';

const HERE = import.meta.dirname;
loadEnv({ path: path.join(HERE, '..', '..', '.env'), quiet: true });
const KEY = process.env.GEMINI_API_KEY?.trim();
if (!KEY) throw new Error('Set GEMINI_API_KEY in the environment or in the repo .env.');

const VARIANTS = (process.env.MODELS ?? 'gemini-3.6-flash,gemini-4-hydrogen,gemini-4-hydrogen@medium').split(',');
const CASE_IDS = process.env.CASES?.split(',') ?? CASES.map((c) => c.id);
const REPEATS = Number(process.env.REPEATS ?? 3);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
const BUDGET_MS = Number(process.env.BUDGET_MS ?? 120_000);
// en-CA formats as YYYY-MM-DD, in local time like the dates in the write-up.
const OUT = path.resolve(process.env.OUT ?? path.join(HERE, 'results', new Date().toLocaleDateString('en-CA')));
const QUOTA_WAIT_MS = 30_000;

const pageTransport = createPinnedTransport(systemResolver);

/** Wraps fetch for Gemini calls: records each call, keeps its raw response, and applies a research thinking override. */
function recordingFetch(calls: CallRecord[], raw: RawResponse[], researchThinking: string | null): typeof fetch {
  return async (input, init) => {
    const body = JSON.parse(String(init?.body)) as { response_format?: unknown; generation_config?: Record<string, unknown> };
    const kind = body.response_format ? 'format' : 'research';
    if (kind === 'research' && researchThinking) body.generation_config = { ...body.generation_config, thinking_level: researchThinking };
    const record: CallRecord = {
      kind,
      ms: 0,
      status: null,
      thinkingLevel: (body.generation_config?.thinking_level as string | undefined) ?? null,
      servedModel: null,
      usage: null,
      searches: 0,
      error: null,
    };
    calls.push(record);
    const started = performance.now();
    try {
      const response = await fetch(input, { ...init, body: JSON.stringify(body) });
      const json = (await response.clone().json().catch(() => null)) as
        | (RawResponse['body'] & { model?: string; usage?: CallRecord['usage']; error?: { message?: string } })
        | null;
      record.status = response.status;
      record.servedModel = json?.model ?? null;
      record.usage = json?.usage ?? null;
      record.searches = (json?.steps ?? [])
        .filter((step) => step.type === 'google_search_call')
        .reduce((sum, step) => sum + (step.arguments?.queries?.length ?? 0), 0);
      if (!response.ok) record.error = json?.error?.message?.slice(0, 300) ?? `HTTP ${response.status}`;
      raw.push({ kind, status: response.status, body: json });
      return response;
    } catch (error) {
      record.error = error instanceof Error ? error.name : String(error);
      throw error;
    } finally {
      record.ms = Math.round(performance.now() - started);
    }
  };
}

const photoCache = new Map<string, string>();
async function photoDataUrl(file: string | null): Promise<string | null> {
  if (!file) return null;
  if (!photoCache.has(file)) {
    const bytes = await readFile(path.join(HERE, 'photos', file));
    photoCache.set(file, `data:image/jpeg;base64,${bytes.toString('base64')}`);
  }
  return photoCache.get(file)!;
}

async function attempt(variant: string, benchCase: BenchCase) {
  const [model, researchThinking = null] = variant.split('@');
  const calls: CallRecord[] = [];
  const raw: RawResponse[] = [];
  const phases: Record<string, number> = {};
  const request = { ...benchCase.request, photoDataUrl: await photoDataUrl(benchCase.photo) };
  const started = performance.now();
  let report: Investigation | null = null;
  let error: string | null = null;
  try {
    report = await runInvestigation(
      request,
      { getContext: async () => benchCase.context },
      {
        env: { GEMINI_API_KEY: KEY, GEMINI_MODEL: model },
        fetch: recordingFetch(calls, raw, researchThinking),
        resolve: systemResolver,
        pageTransport,
        now: () => new Date(),
        contextWaitMs: CONTEXT_WAIT_MS,
        budgetMs: BUDGET_MS,
        pageTimeoutMs: PAGE_TIMEOUT_MS,
        onPhase: (name, ms) => {
          phases[name] = ms;
        },
      },
    );
  } catch (caught) {
    error = caught instanceof ApiError ? caught.code : caught instanceof Error ? caught.message : String(caught);
  }
  return { model, report, error, calls, raw, phases, ms: Math.round(performance.now() - started), request };
}

async function runOne(variant: string, benchCase: BenchCase, repeat: number) {
  const startedAt = new Date().toISOString();
  let run = await attempt(variant, benchCase);
  if (run.error === 'RESEARCH_QUOTA') {
    console.log(`${variant} ${benchCase.id} r${repeat}: rate limited, retrying in ${QUOTA_WAIT_MS / 1000} s`);
    await sleep(QUOTA_WAIT_MS);
    run = await attempt(variant, benchCase);
  }
  const { report } = run;
  const email = report
    ? createEmailDraft({
        report,
        place: run.request.location,
        details: run.request.details,
        photoFileName: benchCase.photo ? 'photo.jpg' : null,
      })
    : null;
  const row: RunRow = {
    variant,
    model: run.model,
    case: benchCase.id,
    repeat,
    startedAt,
    ms: run.ms,
    phases: run.phases,
    error: run.error,
    calls: run.calls,
    report:
      report && email
        ? {
            verdict: report.responsibility.verdict,
            organization: report.responsibility.organization,
            department: report.responsibility.department,
            kind: report.issue.kind,
            summary: report.issue.summary,
            spot: report.issue.spot,
            warnings: report.warnings,
            email: { subject: email.subject, body: email.body },
            evidence: report.responsibility.evidence !== null,
            contact: !!(report.responsibility.email || report.responsibility.phone || report.responsibility.reportingUrl),
            sources: report.sources.length,
            officialSources: report.sources.filter((source) => source.official).length,
          }
        : null,
    named: namedOffice(run.raw),
  };
  await appendFile(path.join(OUT, 'results.jsonl'), `${JSON.stringify(row)}\n`);
  await writeFile(
    path.join(OUT, 'raw', `${variant}__${benchCase.id}__r${repeat}.json`),
    // Thought and tool-step signatures are opaque encrypted state: most of a response's bytes, nothing to read.
    JSON.stringify({ row, investigation: report, responses: run.raw }, (key, value) => (key === 'signature' ? undefined : value), 2),
  );
  const searches = run.calls.reduce((sum, call) => sum + call.searches, 0);
  const tokens = run.calls.reduce((sum, call) => sum + (call.usage?.total_tokens ?? 0), 0);
  const outcome = row.report
    ? `${row.report.verdict.padEnd(12)} ${row.report.organization ?? '-'} / ${row.report.department ?? '-'}`
    : `ERROR ${run.error}`;
  console.log(
    `${variant.padEnd(26)} ${benchCase.id} r${repeat} ${(run.ms / 1000).toFixed(1).padStart(5)} s  ${String(searches).padStart(2)} searches ${String(tokens).padStart(6)} tok  ${outcome}`,
  );
}

const jobs: Array<() => Promise<void>> = [];
for (let repeat = 1; repeat <= REPEATS; repeat += 1) {
  for (const id of CASE_IDS) {
    const benchCase = CASES.find((c) => c.id === id);
    if (!benchCase) throw new Error(`Unknown case ${id}. Cases: ${CASES.map((c) => c.id).join(', ')}`);
    // Variants interleave, so every model sees the same network and search conditions.
    for (const variant of VARIANTS) jobs.push(() => runOne(variant, benchCase, repeat));
  }
}

await mkdir(path.join(OUT, 'raw'), { recursive: true });
console.log(`${jobs.length} reports (${VARIANTS.join(', ')}; cases ${CASE_IDS.join(',')}; ${REPEATS} each) → ${OUT}`);
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) await job();
  }),
);
console.log('done');
