// Summarizes one bench.ts run: npx tsx benchmarks/gemini-models/summarize.ts [results/<date>] (default: newest run).
// Re-scores every row with cases.ts, so fixing an expectation needs no re-run. Prints Markdown tables and writes
// summary.json next to results.jsonl.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CASES, score, type CallRecord, type RunRow, type Scores } from './cases';

const RESULTS = path.join(import.meta.dirname, 'results');
const runDir = path.resolve(process.argv[2] ?? path.join(RESULTS, readdirSync(RESULTS).sort().at(-1)!));
const rows: RunRow[] = readFileSync(path.join(runDir, 'results.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as RunRow);

/** The app's limit for a whole report (BUDGET_MS in server/research/pipeline.ts). */
const APP_BUDGET_MS = 45_000;

interface Price {
  input: number;
  cached: number;
  output: number;
}
// Paid tier, USD per 1M tokens, from https://ai.google.dev/gemini-api/docs/pricing (read 2026-11-19). Tool-use tokens
// (search results and pages the model reads) bill as input; thinking bills as output.
const PRICES: Record<string, { now: Price; from2027: Price }> = {
  'gemini-3.6-flash': {
    now: { input: 0.75, cached: 0.075, output: 3.75 },
    from2027: { input: 1.5, cached: 0.15, output: 7.5 },
  },
  'gemini-4-hydrogen': {
    now: { input: 1.5, cached: 0.075, output: 7.5 },
    from2027: { input: 1.5, cached: 0.075, output: 7.5 },
  },
};
/** After the 5,000 free searches a month shared by all Gemini 3 and newer models on the project. */
const USD_PER_SEARCH = 14 / 1000;

function callCost(call: CallRecord, price: Price): number {
  const u = call.usage ?? {};
  const cached = u.total_cached_tokens ?? 0;
  const input = (u.total_input_tokens ?? 0) - cached + (u.total_tool_use_tokens ?? 0);
  const output = (u.total_thought_tokens ?? 0) + (u.total_output_tokens ?? 0);
  return (input * price.input + cached * price.cached + output * price.output) / 1e6;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length === 0 ? NaN : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentile = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)];
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const cents = (usd: number) => `${(usd * 100).toFixed(2)}¢`;
const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const count = (n: number, of: number) => `${n}/${of}`;
const tokensOf = (rows: RunRow[], kind: CallRecord['kind'], field: keyof NonNullable<CallRecord['usage']>) =>
  Math.round(mean(rows.map((row) => sum(row.calls.filter((c) => c.kind === kind).map((c) => c.usage?.[field] ?? 0)))));

const variants = [...new Set(rows.map((row) => row.variant))];
const summary = variants.map((variant) => {
  const runs = rows.filter((row) => row.variant === variant);
  const model = runs[0].model;
  const finished = runs.filter((row) => row.report !== null);
  const scored = finished.map((row) => ({ row, scores: score(CASES.find((c) => c.id === row.case)!, row.report!) }));
  const hits = (key: keyof Scores) => scored.filter(({ scores }) => scores[key]).length;
  const withOwnerClaim = scored.filter(({ row }) => CASES.find((c) => c.id === row.case)!.expect.ownerClaim !== null);
  const namedRight = (row: RunRow) =>
    row.named !== null &&
    CASES.find((c) => c.id === row.case)!.expect.office.test(`${row.named.organization ?? ''} ${row.named.department ?? ''}`);
  const withoutPhoto = scored.filter(({ row }) => CASES.find((c) => c.id === row.case)!.photo === null);
  const price = PRICES[model];
  const tokenCost = (when: 'now' | 'from2027') =>
    price ? finished.map((row) => sum(row.calls.map((call) => callCost(call, price[when])))) : [];
  const searches = finished.map((row) => sum(row.calls.map((call) => call.searches)));
  const times = finished.map((row) => row.ms);
  const now = tokenCost('now');
  return {
    variant,
    model,
    servedBy: [...new Set(runs.flatMap((row) => row.calls.map((call) => call.servedModel).filter(Boolean)))],
    thinking: [...new Set(runs.flatMap((row) => row.calls.map((call) => `${call.kind}:${call.thinkingLevel}`)))].sort(),
    runs: runs.length,
    errors: runs.filter((row) => row.error).map((row) => `${row.case} r${row.repeat}: ${row.error}`),
    appOk: runs.filter((row) => row.report && row.ms <= APP_BUDGET_MS).length,
    medianMs: median(times),
    p90Ms: percentile(times, 90),
    maxMs: Math.max(...times),
    over45: times.filter((ms) => ms > APP_BUDGET_MS).length,
    finished: finished.length,
    confirmed: finished.filter((row) => row.report!.verdict === 'confirmed').length,
    bestMatch: finished.filter((row) => row.report!.verdict === 'best_match').length,
    unidentified: finished.filter((row) => row.report!.verdict === 'unidentified').length,
    contact: finished.filter((row) => row.report!.contact).length,
    namedOk: runs.filter(namedRight).length,
    officeOk: hits('officeOk'),
    kindOk: hits('kindOk'),
    spotOk: hits('spotOk'),
    factOk: hits('factOk'),
    ownerLeak: `${hits('ownerLeak')}/${withOwnerClaim.length}`,
    photoLeak: `${hits('photoLeak')}/${withoutPhoto.length}`,
    tokens: {
      research: {
        input: tokensOf(finished, 'research', 'total_input_tokens'),
        cached: tokensOf(finished, 'research', 'total_cached_tokens'),
        toolUse: tokensOf(finished, 'research', 'total_tool_use_tokens'),
        thought: tokensOf(finished, 'research', 'total_thought_tokens'),
        output: tokensOf(finished, 'research', 'total_output_tokens'),
      },
      format: {
        input: tokensOf(finished, 'format', 'total_input_tokens'),
        thought: tokensOf(finished, 'format', 'total_thought_tokens'),
        output: tokensOf(finished, 'format', 'total_output_tokens'),
      },
      total: Math.round(mean(finished.map((row) => sum(row.calls.map((call) => call.usage?.total_tokens ?? 0))))),
    },
    searchesMean: mean(searches),
    searchesMax: Math.max(...searches),
    tokenCostNow: { median: median(now), mean: mean(now) },
    tokenCostFrom2027: mean(tokenCost('from2027')),
    searchCostMean: mean(searches) * USD_PER_SEARCH,
    wrong: scored
      .filter(({ scores }) => !scores.officeOk || !scores.kindOk)
      .map(({ row }) => `${row.case} r${row.repeat}: ${row.report!.kind} / ${row.report!.verdict} / ${row.report!.organization} / ${row.report!.department}`),
    perCase: CASES.map((c) => {
      const caseRuns = scored.filter(({ row }) => row.case === c.id);
      return {
        case: c.id,
        runs: runs.filter((row) => row.case === c.id).length,
        officeOk: caseRuns.filter(({ scores }) => scores.officeOk).length,
        namedOk: runs.filter((row) => row.case === c.id && namedRight(row)).length,
        confirmed: caseRuns.filter(({ row }) => row.report!.verdict === 'confirmed').length,
        spotOk: caseRuns.filter(({ scores }) => scores.spotOk).length,
        factOk: caseRuns.filter(({ scores }) => scores.factOk).length,
        medianMs: median(caseRuns.map(({ row }) => row.ms)),
      };
    }).filter((c) => c.runs > 0),
  };
});

writeFileSync(path.join(runDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

const table = (head: string[], body: string[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...body.map((r) => `| ${r.join(' | ')} |`)].join('\n');

console.log(`# ${path.basename(runDir)}: ${rows.length} reports\n`);
console.log('## Quality\n');
console.log(
  table(
    ['Variant', 'Reports done in 45 s', 'Model named right office', 'Office shown (after page checks)', 'Confirmed / Best match / Unidentified', 'Contact found', 'Issue kind', 'Exact spot', 'Note fact in summary', 'Owner guess in email', 'Photo mentioned (no photo)'],
    summary.map((s) => [
      `\`${s.variant}\``,
      count(s.appOk, s.runs),
      count(s.namedOk, s.runs),
      count(s.officeOk, s.finished),
      `${s.confirmed} / ${s.bestMatch} / ${s.unidentified}`,
      count(s.contact, s.finished),
      count(s.kindOk, s.finished),
      count(s.spotOk, s.finished),
      count(s.factOk, s.finished),
      s.ownerLeak,
      s.photoLeak,
    ]),
  ),
);
console.log('\n## Speed (whole report)\n');
console.log(
  table(
    ['Variant', 'Median', '90th percentile', 'Slowest', 'Over 45 s', 'Errors'],
    summary.map((s) => [`\`${s.variant}\``, secs(s.medianMs), secs(s.p90Ms), secs(s.maxMs), String(s.over45), String(s.errors.length)]),
  ),
);
console.log('\n## Cost per report\n');
console.log(
  table(
    ['Variant', 'Tokens (mean)', 'Research thinking', 'Format thinking', 'Search & pages', 'Searches (mean / max)', 'Tokens now (median / mean)', 'Tokens from 2027-01-01 (mean)', 'Searches after free 5,000 (mean)'],
    summary.map((s) => [
      `\`${s.variant}\``,
      s.tokens.total.toLocaleString('en-US'),
      s.tokens.research.thought.toLocaleString('en-US'),
      s.tokens.format.thought.toLocaleString('en-US'),
      s.tokens.research.toolUse.toLocaleString('en-US'),
      `${s.searchesMean.toFixed(1)} / ${s.searchesMax}`,
      `${cents(s.tokenCostNow.median)} / ${cents(s.tokenCostNow.mean)}`,
      cents(s.tokenCostFrom2027),
      cents(s.searchCostMean),
    ]),
  ),
);
console.log('\n## Per case (model named right / office shown / confirmed / exact spot / note fact, median time)\n');
console.log(
  table(
    ['Case', ...summary.map((s) => `\`${s.variant}\``)],
    CASES.filter((c) => summary.some((s) => s.perCase.some((p) => p.case === c.id))).map((c) => [
      c.id,
      ...summary.map((s) => {
        const p = s.perCase.find((x) => x.case === c.id);
        return p ? `${p.namedOk}/${p.officeOk}/${p.confirmed}/${p.spotOk}/${p.factOk} of ${p.runs}, ${secs(p.medianMs)}` : '-';
      }),
    ]),
  ),
);
for (const s of summary) {
  if (s.errors.length || s.wrong.length) {
    console.log(`\n### \`${s.variant}\` misses\n`);
    for (const line of [...s.errors.map((e) => `error ${e}`), ...s.wrong.map((w) => `wrong ${w}`)]) console.log(`- ${line}`);
  }
}
