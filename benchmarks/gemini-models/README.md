# Gemini model benchmark

Data and scripts behind [docs/gemini-model-benchmark.md](../../docs/gemini-model-benchmark.md), which explains the results and why the app uses `gemini-3.6-flash`.

```
bench.ts                  Runs the app's real report pipeline (server/research) per model, case, and repeat
cases.ts                  The test cases, their expected answers, scoring, and the results.jsonl row shape
summarize.ts              Per-model quality, speed, tokens, searches, and cost for one run; writes summary.json
photos/                   The four test photos (caseA–D.jpg), re-encoded the way the app does it
results/<date>/
  results.jsonl           One line per report: time, phases, every Gemini call's tokens and searches, the answer
  summary.json            Output of summarize.ts for this run
  raw/                    The investigation and Gemini responses for every report, <variant>__<case>__r<n>.json
                          (opaque `signature` fields dropped: they were most of the bytes and carry nothing readable)
```

`bench.ts` imports the app's own pipeline, prompts, checks, and email builder, so a run always measures what the app does today: the research call (Google Search and URL context), the format call, the server's page checks, and the email draft. Map facts are fixed per case, so every model gets identical input.

## Running it

**It costs money.** Each report is two Gemini calls plus the Google searches the model chooses to run; see the latest run in the write-up for what a full run cost. Searches come out of the project's 5,000 free searches a month, shared by all Gemini 3+ models and by the live site, and after that cost $14 per 1,000.

Run it from the repo root. The key comes from `GEMINI_API_KEY` in the environment, or from the repo's `.env`.

```bash
npx tsx benchmarks/gemini-models/bench.ts
npx tsx benchmarks/gemini-models/summarize.ts benchmarks/gemini-models/results/<date>
```

Options, as environment variables:

| Variable | Default | Use |
|---|---|---|
| `MODELS` | `gemini-3.6-flash,gemini-4-hydrogen,gemini-4-hydrogen@medium` | Comma-separated variants. `model@level` overrides only the research call's thinking level, to test a setting the app doesn't use yet; without it, the app's own levels apply. |
| `CASES` | `A,B,C,D,E,F` | Which test cases to run (see `cases.ts`) |
| `REPEATS` | `3` | Reports per variant and case |
| `CONCURRENCY` | `3` | Reports in flight at once. Variants interleave, so each model sees the same network and search conditions. |
| `BUDGET_MS` | `120000` | Per-report limit. Higher than the app's 45 s so slow runs still finish; `summarize.ts` counts anything over 45 s as a report the app would have failed. |
| `OUT` | `results/<today>` | Where results go. Runs append to `results.jsonl`, so give each new run its own folder. |

`summarize.ts` re-scores every row with `cases.ts`, so an expectation can be fixed without re-running. Token prices are in `summarize.ts`; update them when Google's pricing page changes.

The 2026-11-07 run in `results/2026-11-07/` came from an earlier script that sent only the research call, with a copy of that day's prompt and no note. That script is in the git history (`benchmarks/gemini-models/bench.mjs` before 2026-11-19); its rows have a different shape, and its `summary.json` is final.

## Photo credits

All four photos are from Wikimedia Commons. They are resized copies, shared under the same licenses as the originals.

| File | Original | Author | License |
|---|---|---|---|
| `photos/caseA.jpg` | [Bch 169th St Ft Tilden Riis Park td 03.jpg](https://commons.wikimedia.org/wiki/File:Bch_169th_St_Ft_Tilden_Riis_Park_td_03.jpg) | Tdorante10 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `photos/caseB.jpg` | [Cracked sidewalk 1.jpg](https://commons.wikimedia.org/wiki/File:Cracked_sidewalk_1.jpg) | Downtowngal | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `photos/caseC.jpg` | [Damaged lamp post, Fira, Santorini, Greece (approx. GPS location) julesvernex2.jpg](https://commons.wikimedia.org/wiki/File:Damaged_lamp_post,_Fira,_Santorini,_Greece_(approx._GPS_location)_julesvernex2.jpg) | Jules Verne Times Two | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `photos/caseD.jpg` | [18ApSeabrookPothole1.jpg](https://commons.wikimedia.org/wiki/File:18ApSeabrookPothole1.jpg) | Infrogmation | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
