# Gemini model benchmark

**Decision: Fix Please uses `gemini-3.6-flash`.** It is the default in the code and in `.env.example`. Override it with `GEMINI_MODEL`. Re-checked on 2026-11-19 against `gemini-4-hydrogen`, which is not better for this app.

- [2026-11-19: Gemini 4 Hydrogen vs Gemini 3.6 Flash, on full reports](#2026-11-19-gemini-4-hydrogen-vs-gemini-36-flash-on-full-reports)
- [2026-11-07: every model, on the research call only](#2026-11-07-every-model-on-the-research-call-only)

## 2026-11-19: Gemini 4 Hydrogen vs Gemini 3.6 Flash, on full reports

The question: is `gemini-4-hydrogen` (released 2026-11-12) better and cheaper for Fix Please than `gemini-3.6-flash`?

### Answer

**No. Keep `gemini-3.6-flash`.** Hydrogen named the right office just as often, but it was slower, found fewer contacts, and costs about 3.6× as much in tokens per report. It runs about half as many Google searches, so it only becomes cheaper after the project has used up its 5,000 free searches for the month, at roughly 465 reports a month.

- **Accuracy: a tie.** Both models named the right office in 18 of 18 reports and reached the same verdicts (9 confirmed, 6 best match, 3 unidentified). Both handled the note the same way: every summary carried the note's fact about the problem, no owner guess from a note reached an email, and no report without a photo mentioned one.
- **Speed: Hydrogen is slower.** Median report 24.7 s against 14.5 s. Two of 18 Hydrogen reports took over the app's 45 s limit (their research call alone took 46 s), so the app would have shown an error. 3.6 Flash's slowest report took 24.9 s. In the follow-up run, one more Hydrogen research call failed with a network error after 70 s.
- **Contacts: Hydrogen found fewer.** A report form, email, or phone number in 11 of 15 reports that named an office, against 15 of 15. On the campus sidewalk note (case F) it found none in three runs.
- **Exact spot: a prompt bug, now fixed.** In the main run, Hydrogen kept the note's place names in `issue.spot` 18 of 18 times; 3.6 Flash 13 of 18, dropping "Knox Road" and "McKeldin Library". The format call's `spot` description (`server/research/schema.ts`) now tells the model to keep the note's own names and numbers. Re-run on those two cases, 3.6 Flash kept them 6 of 6 times.
- **Hydrogen at `medium` thinking is not usable here.** Median 56 s, 14 of 18 reports over 45 s, 6.3¢ in tokens and 23 searches per report, for the same answers.
- **Hydrogen needed an app fix to run at all.** It rejects `thinking_level: "minimal"`, which the format call used, so every Hydrogen report failed. The format call now asks each model for the lowest level it accepts (`lowestThinkingLevel` in `server/research/gemini.ts`): `minimal` for 3.6 Flash, `low` for Hydrogen and other Gemini 4 models. That is why Hydrogen's format call thinks about 730 tokens and takes about 6.9 s, against 0 tokens and 2.7 s.
- **Case D found an app problem, not a model problem.** All three variants named Prince George's County DPW&T every time, but `princegeorgescountymd.gov` answers the server's page loader with HTTP 403, so no county page loaded and the app withheld the answer as "unidentified". This is in `TODO.md`.

### Quality

Main run, 3 reports per model per case. "Model named right office" scores the format call's answer before the server's checks; "Office shown" is what the user sees.

| Variant | Reports done in 45 s | Model named right office | Office shown | Confirmed / Best match / Unidentified | Contact found | Issue kind | Exact spot | Note fact in summary | Owner guess in email | Photo mentioned (no photo) |
|---|---|---|---|---|---|---|---|---|---|---|
| `gemini-3.6-flash` | 18/18 | 18/18 | 15/18 | 9 / 6 / 3 | 15/18 | 18/18 | 13/18 (B and E after the fix: 6/6) | 18/18 | 0/9 | 0/6 |
| `gemini-4-hydrogen` | 16/18 | 18/18 | 15/18 | 9 / 6 / 3 | 11/18 | 18/18 | 18/18 | 18/18 | 0/9 | 0/6 |
| `gemini-4-hydrogen@medium` | 4/18 | 18/18 | 15/18 | 9 / 6 / 3 | 11/18 | 18/18 | 18/18 | 18/18 | 0/9 | 0/6 |

Per case: model named right / office shown / confirmed / exact spot / note fact, out of 3, and the median time.

| Case | `gemini-3.6-flash` | `gemini-4-hydrogen` | `gemini-4-hydrogen@medium` |
|---|---|---|---|
| A | 3/3/3/3/3, 14.9 s | 3/3/3/3/3, 23.1 s | 3/3/3/3/3, 53.5 s |
| B | 3/3/0/1/3, 24.2 s | 3/3/0/3/3, 33.8 s | 3/3/0/3/3, 96.2 s |
| C | 3/3/3/3/3, 11.6 s | 3/3/3/3/3, 20.7 s | 3/3/3/3/3, 52.7 s |
| D | 3/0/0/3/3, 11.8 s | 3/0/0/3/3, 27.1 s | 3/0/0/3/3, 55.7 s |
| E | 3/3/3/0/3, 10.3 s | 3/3/3/3/3, 18.6 s | 3/3/3/3/3, 37.8 s |
| F | 3/3/0/3/3, 21.8 s | 3/3/0/3/3, 24.8 s | 3/3/0/3/3, 106.3 s |

No model reached "confirmed" on the campus cases (B, F): in none of those reports was a coverage sentence found word for word on a page the server loaded, so they stayed "best match".

### Speed

Whole report, from the start of the research call to the finished result.

| Variant | Median | 90th percentile | Slowest | Over 45 s | Research call (median) | Format call (median) |
|---|---|---|---|---|---|---|
| `gemini-3.6-flash` | 14.5 s | 24.3 s | 24.9 s | 0 | 11.9 s | 2.7 s |
| `gemini-4-hydrogen` | 24.7 s | 51.5 s | 53.8 s | 2 | 18.0 s | 6.9 s |
| `gemini-4-hydrogen@medium` | 56.1 s | 109.5 s | 114.3 s | 14 | 49.5 s | 6.9 s |

### Cost per report

Prices from [Google's pricing page](https://ai.google.dev/gemini-api/docs/pricing), read on 2026-11-19. `gemini-3.6-flash` costs $0.75 per 1M input tokens and $3.75 per 1M output tokens (including thinking) through 2026-12-31, then $1.50 and $7.50, the same as `gemini-4-hydrogen`. Google Search grounding is the same for both: 5,000 free searches a month per project, shared by every Gemini 3 and newer model, then $14 per 1,000, with a cap of 1,500 a day.

| Variant | Tokens (mean, both calls) | Thinking (research / format) | Searches (mean / max) | Token cost now (median / mean) | Token cost from 2027-01-01 (mean) | Search cost after the free 5,000 (mean) |
|---|---|---|---|---|---|---|
| `gemini-3.6-flash` | 4,826 | 755 / 0 | 12.2 / 27 | 0.79¢ / 0.78¢ | 1.57¢ | 17.1¢ |
| `gemini-4-hydrogen` | 7,356 | 927 / 727 | 5.8 / 15 | 2.66¢ / 2.79¢ | 2.79¢ | 8.1¢ |
| `gemini-4-hydrogen@medium` | 12,396 | 4,250 / 788 | 23.3 / 55 | 5.89¢ / 6.26¢ | 6.26¢ | 32.6¢ |

Searches depend on the place more than anything. On the two campus cases 3.6 Flash ran 24–25 searches per report and Hydrogen 10–12; elsewhere 3.6 Flash ran 5–7 and Hydrogen 2–5. A mostly-campus mix of real reports would push both averages up.

**Monthly cost**, with this run's averages and nothing else using the project's searches:

| Reports a month | `gemini-3.6-flash` now | `gemini-3.6-flash` from 2027-01-01 | `gemini-4-hydrogen` |
|---|---|---|---|
| 200 | $1.56 | $3.14 | $5.58 |
| 400 | $3.12 | $6.28 | $11.16 |
| 600 | $37.16 | $41.90 | $16.74 |
| 1,000 | $108.60 | $116.50 | $39.10 |

3.6 Flash uses up the free searches at about 410 reports a month and Hydrogen at about 860. Hydrogen becomes the cheaper model above about 465 reports a month (about 440 from 2027-01-01). The 1,500-searches-a-day cap allows about 120 reports a day on 3.6 Flash and about 260 on Hydrogen. If the live site grows past those numbers, re-run this benchmark and weigh Hydrogen's lower search bill against its speed and the reports it would lose to the 45 s limit.

### How this run worked

- **What ran:** the app's own report pipeline (`runInvestigation` in `server/research/pipeline.ts`), imported by [`benchmarks/gemini-models/bench.ts`](../benchmarks/gemini-models/bench.ts): the research call (Google Search and URL context, `thinking_level: low`), the format call (structured JSON, the lowest thinking level the model accepts), the server's checks of every cited page on the live web, and the email draft. Nothing is copied from the app, so the benchmark can't drift from it. `@medium` raised only the research call's thinking level.
- **Map facts:** fixed per case and identical for every model, so the public map services' outages didn't matter.
- **Runs:** 3 reports per model per case, 3 in flight at once, models interleaved so each saw the same network and search conditions. 54 reports in the main run (`results/2026-11-19/`), and 11 finished reports of 12 in the follow-up run on cases B and E after the spot fix (`results/2026-11-19-spot-names/`). The per-report limit was raised to 120 s so slow reports still finished; anything over 45 s is counted as a report the app would have failed.
- **Scoring:** "Issue kind" means the kind is in the accepted set. "Office" means the organization and department together name the expected office. "Exact spot" means `issue.spot` contains the place the note names (7-Eleven, McKeldin, pole 86-112, storm drain, Knox Road, bike racks). "Note fact" means the summary carries a fact only the note gave (2 weeks or the tire, 3 inches or the trip, Friday or dark, 4 feet, swerving, wheelchairs). "Owner guess in email" means the note's wrong guess about the owner reached the email.
- **Usage:** both runs together made 65 finished reports for about $1.95 in tokens and about 865 Google searches.
- Tool-use tokens (search results and pages the model reads) were 0 in every call this time, unlike the 2026-11-07 run.

### The six cases

Cases A–D reuse the 2026-11-07 photos and pins (see [Test cases](#test-cases)); every case now has a note. Cases E and F have no photo.

| Case | Photo | Pin | Note | Correct office |
|---|---|---|---|---|
| A | Water-filled pothole | Baltimore Avenue (US 1), College Park | Northbound right lane by the 7-Eleven, growing 2 weeks, popped a tire; guesses "the city owns this road" | Maryland State Highway Administration |
| B | Cracked sidewalk | Library Lane, University of Maryland | Slab lifted 3 inches outside McKeldin Library's south entrance; someone tripped | UMD Facilities Management |
| C | Broken streetlight | West 86th Street, Manhattan | Pole number 86-112; smashed since Friday, block dark at night | NYC Department of Transportation |
| D | Road cave-in | Tecumseh Street, unincorporated Adelphi, MD | Names an HOA; caved in by the storm drain, 4 feet across | Prince George's County DPW&T |
| E | None | Baltimore Avenue (US 1), College Park | Deep pothole, southbound left lane at the Knox Road light, cars swerve; guesses a property manager | Maryland State Highway Administration |
| F | None | Library Lane, University of Maryland | Crack across the sidewalk by the bike racks; wheelchairs can't get over it | UMD Facilities Management |

To re-run it, see [`benchmarks/gemini-models/README.md`](../benchmarks/gemini-models/README.md).

## 2026-11-07: every model, on the research call only

Run on 2026-11-07 to choose the model that reads the photo and finds who fixes the problem. This run timed and scored only the research call, with that day's prompt and no note.

### Summary

- Seven distinct models could run the app's research request. **All seven got the issue type and the responsible office right in every test case**, including the previous default, `gemini-3.5-flash-lite`.
- The models differed in speed, in how many Google searches they ran, and in how detailed their photo descriptions were.
- `gemini-3.6-flash` was chosen because it:
  - was correct every time
  - wrote clearly more precise descriptions than the Flash-Lite models
  - took 21 s in its slowest run, inside the app's 45 s limit for a whole report
  - costs under 1¢ in tokens per report

  The trade-offs are about 4× Flash-Lite's token cost and about 3× its searches. Searches are what cost money at scale (see [Cost](#cost)).
- `gemini-3.8-flash` costs the same per token but ran about twice as many searches and took about twice as long, with runs near or over 45 s. `gemini-4-argon` and `gemini-3.1-pro-preview` are too slow for the app.
- These were easy, unambiguous cases (four photos, one run per model name per case). They show cost and speed well, but they are a weak test of accuracy on hard, real-world reports. Re-test with any photo and pin that gives a wrong answer.

### Results by model

Times are for the research request only (see [Method](#method)). Model names that Google redirected to another model are merged into the model that actually answered; see [Aliases](#aliases).

| Model | Runs | Median time | Fastest | Slowest | Runs over 45 s | Median tokens | Mean tokens | Max tokens | Searches per report (avg / max) | Token cost per report (median / mean) | Issue kind right | Office right |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `gemini-3.5-flash-lite` (previous default) | 8 | 5.0 s | 3.3 s | 7.9 s | 0 | 2,426 | 2,476 | 2,896 | 3.6 / 8 | 0.16¢ / 0.17¢ | 8/8 | 8/8 |
| `gemini-3.1-flash-lite` | 8 | 5.8 s | 3.6 s | 7.7 s | 0 | 2,854 | 3,002 | 3,668 | 3.1 / 4 | 0.16¢ / 0.18¢ | 8/8 | 8/8 |
| `gemini-3-flash-preview` | 4 | 6.5 s | 4.9 s | 8.1 s | 0 | 2,460 | 2,489 | 2,618 | 4.8 / 5 | 0.23¢ / 0.24¢ | 4/4 | 4/4 |
| **`gemini-3.6-flash` (chosen)** | 8 | 12.7 s | 7.3 s | 20.8 s | 0 | 3,615 | 7,797 | 21,018 | 9.8 / 23 | 0.63¢ / 0.95¢ | 8/8 | 8/8 |
| `gemini-3.1-pro-preview` | 8 | 21.1 s | 12.4 s | 46.4 s | 1 | 4,605 | 18,499 | 87,613 | 7.5 / 22 | 2.65¢ / 5.25¢ | 8/8 | 8/8 |
| `gemini-3.8-flash` | 12 | 21.7 s | 9.6 s | 48.8 s | 1 | 3,424 | 20,439 | 101,831 | 19.0 / 50 | 0.62¢ / 1.80¢ | 12/12 | 12/12 |
| `gemini-4-argon` | 3 + 1 timeout | 78.6 s | 55.6 s | over 180 s | all 4 | 4,020 | 4,183 | 4,941 | 13.3 / 17 | 2.13¢ / 2.29¢ | 3/3 | 3/3 |

#### Where the tokens go

Averages per report. "Rest of input" is the prompt, the pin, and the map facts, plus any hidden tool instructions Google adds. "Search & pages" is the search-result and web-page text the model pulled in through Google Search and URL context. It is billed as input and causes almost all of the variation.

| Model | Image | Rest of input | Thinking | Output | Search & pages | Total (mean) | Total (max) |
|---|---|---|---|---|---|---|---|
| `gemini-3.5-flash-lite` | 1,072 | 972 | 0 | 432 | 0 | 2,476 | 2,896 |
| `gemini-3.1-flash-lite` | 1,072 | 1,073 | 491 | 366 | 0 | 3,002 | 3,668 |
| `gemini-3-flash-preview` | 1,072 | 972 | 0 | 444 | 0 | 2,489 | 2,618 |
| `gemini-3.6-flash` | 1,072 | 1,317 | 793 | 428 | 4,187 | 7,797 | 21,018 |
| `gemini-3.1-pro-preview` | 1,072 | 1,469 | 1,142 | 405 | 14,411 | 18,499 | 87,613 |
| `gemini-3.8-flash` | 1,072 | 1,136 | 288 | 604 | 17,340 | 20,439 | 101,831 |
| `gemini-4-argon` | 1,075 | 1,286 | 0 | 1,822 | 0 | 4,183 | 4,941 |

`gemini-4-argon` reported no separate thinking tokens, so its output count probably includes its thinking. The photo costs the same for every model, about 1,070 tokens for an image up to 1,920 px.

#### Cost

Paid-tier prices from [Google's pricing page](https://ai.google.dev/gemini-api/docs/pricing), read on 2026-11-07:

| Model | Input per 1M tokens | Output per 1M tokens (incl. thinking) |
|---|---|---|
| `gemini-3.5-flash-lite` | $0.30 | $2.50 |
| `gemini-3.1-flash-lite` | $0.25 | $1.50 |
| `gemini-3-flash-preview` | $0.50 | $3.00 |
| `gemini-3.6-flash` | $0.75 | $3.75 |
| `gemini-3.1-pro-preview` | $2.00 | $12.00 |
| `gemini-3.8-flash` | $0.75 | $3.75 |
| `gemini-4-argon` | $2.00 ($4.00 from 2026-12-01) | $10.00 ($20.00 from 2026-12-01) |

**Searches cost more than tokens.** All Gemini 3 and newer models share 5,000 free Google searches a month per project. After that, each search costs 1.4¢ ($14 per 1,000), with a cap of 1,500 search requests a day.

| Model | Searches per report | Reports a month inside the free 5,000 searches | Search cost per report after that |
|---|---|---|---|
| `gemini-3.1-flash-lite` | 3.1 | about 1,600 | 4.3¢ |
| `gemini-3.5-flash-lite` | 3.6 | about 1,390 | 5.0¢ |
| `gemini-3-flash-preview` | 4.8 | about 1,040 | 6.7¢ |
| `gemini-3.1-pro-preview` | 7.5 | about 670 | 10.5¢ |
| **`gemini-3.6-flash`** | 9.8 | about 510 | 13.7¢ |
| `gemini-4-argon` | 13.3 | about 380 | 18.6¢ |
| `gemini-3.8-flash` | 19.0 | about 260 | 26.6¢ |

The search count is whatever the model chooses for a request. It ranged from 3 to 23 for `gemini-3.6-flash` and from 2 to 50 for `gemini-3.8-flash`. If search spend becomes a problem, cap searches in the prompt or set a Google Cloud budget alert.

#### Description quality

Every model described every photo correctly. The larger models were more specific. Here is how each run described the damaged streetlight (case C). One arm has lost its whole lamp and has a wire sticking out; the other has a bare bulb with no glass.

| Model | What it said |
|---|---|
| `gemini-3.5-flash-lite` | "one bulb missing or broken and another fixture bare"; "one fixture is missing a bulb/cover and another has an exposed bulb" |
| `gemini-3.1-flash-lite` | "one of the lamp fixtures is missing its cover or shade, and the other side appears to be a bare bulb"; the other run only said "one bulb missing or broken" |
| `gemini-3-flash-preview` | "The left lamp fixture is missing its bulb and housing, leaving only the internal components exposed. The right fixture has a bulb but appears to be missing a globe or cover." |
| **`gemini-3.6-flash`** | "one side is missing its light fixture entirely (leaving exposed wires) and the other side has an exposed bulb missing its protective globe" |
| `gemini-3.1-pro-preview` | "The right arm has an exposed bulb, while the left arm is missing its bulb and housing"; the other run only said "one of its two glass fixtures or bulbs is missing" |
| `gemini-3.8-flash` | "The left luminaire is completely missing with exposed wires protruding, and the right arm has an exposed bulb without an enclosing globe or lantern casing." |
| `gemini-4-argon` | "both outer globes/luminaires are missing, the left arm has an empty socket with exposed wire, and the right arm has an exposed bare bulb" |

On the collapsed street (case D), `gemini-3.8-flash` and `gemini-4-argon` also noticed the manhole cover next to the hole, which helps an office find the spot and the likely cause.

### Models that couldn't be tested

| Model | Why |
|---|---|
| `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro` | Google: "no longer available to new users". This project's key can't call them. |
| `gemini-omni-flash-preview`, `gemini-omni-1.1-flash`, `gemini-omni-1.2-flash` | "Search as tool is not enabled for this model". The app needs Google Search. |
| TTS, image-generation (Nano Banana), transcription, robotics, computer-use, and `gemini-3.1-pro-preview-customtools` | Built for other jobs: they can't take a photo and return a researched text answer, or they duplicate a model above. |

### Aliases

Several model names are aliases. Google answered with a different model, shown in the response's `model` field:

| Requested | Answered by |
|---|---|
| `gemini-flash-latest`, `gemini-3.7-flash` | `gemini-3.8-flash` |
| `gemini-3.5-flash` | `gemini-3.6-flash` |
| `gemini-flash-lite-latest` | `gemini-3.5-flash-lite` |
| `gemini-pro-latest` | `gemini-3.1-pro-preview` |
| `gemini-3.1-flash-lite-preview` | `gemini-3.1-flash-lite` |

Set `GEMINI_MODEL` to the exact model you mean. `-latest` names and older version names can silently start pointing at a different model.

### Method

- **Request:** the app's research call. It goes to the Gemini Interactions API (`POST /v1beta/interactions`, `api-revision: 2026-05-20`) with the app's research system instruction, the Google Search and URL context tools, `thinking_level: low` and `store: false`. The input is the app's text layout (pin label, coordinates, address parts, map facts) plus the photo, with no user note, so every model had to read the photo itself.
- **What was timed:** the time from sending the research request to receiving the full response. A real report also waits up to 4 s for map facts, runs a second Gemini call that formats the result as JSON, and checks the cited pages, all inside a 45 s limit. Real reports therefore take longer than the times above.
- **Photos:** re-encoded the way the app does it: longest side at most 1,920 px, JPEG quality 85, metadata removed.
- **Map facts:** the app gets road, campus, and streetlight facts from Overpass, but every public Overpass server timed out from the test network. The same facts were filled in from Nominatim (road name and route number, campus and website) and the U.S. Census geocoder (incorporated or not). Every model got identical input.
- **Runs:** one run per model name per case, run five models at a time. Runs through an alias count toward the model that answered, which is why some models have more runs.
- **Scoring:** "Issue kind right" means the model's `ISSUE_KIND` was in the accepted set for that case. "Office right" means the organization and department together named the expected office. Descriptions were judged by reading them against the photo.
- **Usage:** the test made 51 successful calls and 479 searches and cost about $0.82 in tokens.

#### Test cases

Each case pairs a freely licensed photo with a pin whose maintaining office is certain. The app trusts the confirmed pin for location, so the photo doesn't have to come from that spot.

| Case | Photo | Pin and map facts | Correct office | Accepted issue kinds |
|---|---|---|---|---|
| A | Water-filled pothole ([Tdorante10](https://commons.wikimedia.org/wiki/File:Bch_169th_St_Ft_Tilden_Riis_Park_td_03.jpg), CC BY-SA 4.0) | Baltimore Avenue, College Park, MD. Incorporated city. Route ref **US 1**. | Maryland Department of Transportation State Highway Administration | pothole, road_damage |
| B | Cracked concrete sidewalk ([Downtowngal](https://commons.wikimedia.org/wiki/File:Cracked_sidewalk_1.jpg), CC BY-SA 4.0) | Library Lane, a footway on the University of Maryland campus (website umd.edu). | University of Maryland Facilities Management | sidewalk |
| C | Decorative streetlight missing its lamps ([Jules Verne Times Two](https://commons.wikimedia.org/wiki/File:Damaged_lamp_post,_Fira,_Santorini,_Greece_(approx._GPS_location)_julesvernex2.jpg), CC BY-SA 4.0) | West 86th Street, Manhattan, New York. Incorporated city. | New York City Department of Transportation (reported through 311) | streetlight |
| D | Collapsed street with a cave-in ([Infrogmation](https://commons.wikimedia.org/wiki/File:18ApSeabrookPothole1.jpg), CC BY 3.0) | Tecumseh Street, Adelphi, MD. **Unincorporated**: Adelphi is only a Census Designated Place, though the address says "town: Adelphi". | Prince George's County Department of Public Works and Transportation | pothole, road_damage, drainage |

#### Re-running it

The test photos and every raw API response are in [`benchmarks/gemini-models/`](../benchmarks/gemini-models/); this run's data is in `benchmarks/gemini-models/results/2026-11-07/`. The script that produced it, `bench.mjs`, sent only the research call with a copy of that day's prompt; it was replaced on 2026-11-19 by `bench.ts`, which runs the app's whole pipeline, and is in the git history.

### Appendix: every run

Tokens are per run. Office names are as the model wrote them (organization / department).

| Requested | Answered by | Case | Time (s) | Input | Image | Thinking | Output | Search & pages | Total | Searches | Issue kind | Office named | Office right |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `gemini-3.5-flash-lite` | `gemini-3.5-flash-lite` | A | 3.9 | 2,041 | 1,080 | 0 | 421 | 0 | 2,462 | 2 | pothole | Maryland Department of Transportation State Highway Administration / Maintenance Division | Yes |
| `gemini-flash-lite-latest` | `gemini-3.5-flash-lite` | A | 4.8 | 2,041 | 1,080 | 0 | 349 | 0 | 2,390 | 2 | pothole | Maryland Department of Transportation State Highway Administration / District 3 Office | Yes |
| `gemini-3.5-flash-lite` | `gemini-3.5-flash-lite` | B | 6.9 | 2,047 | 1,064 | 0 | 216 | 0 | 2,263 | 8 | sidewalk | University of Maryland, College Park / Facilities Management | Yes |
| `gemini-flash-lite-latest` | `gemini-3.5-flash-lite` | B | 7.9 | 2,047 | 1,064 | 0 | 225 | 0 | 2,272 | 7 | sidewalk | University of Maryland, College Park / Facilities Management | Yes |
| `gemini-3.5-flash-lite` | `gemini-3.5-flash-lite` | C | 3.9 | 2,035 | 1,064 | 0 | 861 | 0 | 2,896 | 2 | streetlight | New York City Department of Transportation / Division of Street Lighting Engineering | Yes |
| `gemini-flash-lite-latest` | `gemini-3.5-flash-lite` | C | 3.3 | 2,035 | 1,064 | 0 | 340 | 0 | 2,375 | 2 | streetlight | New York City Department of Transportation / Division of Street Lighting Engineering | Yes |
| `gemini-3.5-flash-lite` | `gemini-3.5-flash-lite` | D | 5.2 | 2,054 | 1,080 | 0 | 568 | 0 | 2,622 | 4 | drainage | Prince George's County Government / Department of Public Works and Transportation (DPW&T), Office of Highway Maintenance / Office of Storm Drain Maintenance | Yes |
| `gemini-flash-lite-latest` | `gemini-3.5-flash-lite` | D | 5.7 | 2,054 | 1,080 | 0 | 473 | 0 | 2,527 | 2 | road_damage | Prince George's County Government / Department of Public Works and Transportation | Yes |
| `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | A | 3.6 | 2,041 | 1,080 | 113 | 340 | 0 | 2,494 | 0 | pothole | Maryland Department of Transportation (MDOT) State Highway Administration / Office of Maintenance | Yes |
| `gemini-3.1-flash-lite-preview` | `gemini-3.1-flash-lite` | A | 7.6 | 2,142 | 1,080 | 591 | 585 | 0 | 3,318 | 4 | pothole | Maryland Department of Transportation (MDOT) State Highway Administration (SHA) / District 3 Office | Yes |
| `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | B | 6.0 | 2,145 | 1,064 | 385 | 306 | 0 | 2,836 | 3 | sidewalk | University of Maryland, College Park / Facilities Management (Building and Landscape Maintenance) | Yes |
| `gemini-3.1-flash-lite-preview` | `gemini-3.1-flash-lite` | B | 5.5 | 2,194 | 1,064 | 301 | 308 | 0 | 2,803 | 4 | sidewalk | University of Maryland, College Park / Facilities Management | Yes |
| `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | C | 5.7 | 2,154 | 1,064 | 928 | 297 | 0 | 3,379 | 3 | streetlight | New York City Department of Transportation (NYC DOT) / Division of Street Lighting Engineering | Yes |
| `gemini-3.1-flash-lite-preview` | `gemini-3.1-flash-lite` | C | 3.9 | 2,145 | 1,064 | 209 | 295 | 0 | 2,649 | 3 | streetlight | New York City Department of Transportation (NYC DOT) / Division of Street Lighting Engineering | Yes |
| `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | D | 7.7 | 2,161 | 1,080 | 1,100 | 407 | 0 | 3,668 | 4 | road_damage | Prince George's County Department of Public Works and Transportation / Office of Highway Maintenance | Yes |
| `gemini-3.1-flash-lite-preview` | `gemini-3.1-flash-lite` | D | 5.9 | 2,179 | 1,080 | 300 | 393 | 0 | 2,872 | 4 | road_damage | Prince George's County Department of Public Works and Transportation / Office of Highway Maintenance | Yes |
| `gemini-3-flash-preview` | `gemini-3-flash-preview` | A | 7.2 | 2,041 | 1,080 | 0 | 415 | 0 | 2,456 | 5 | pothole | Maryland Department of Transportation State Highway Administration / District 3 Office | Yes |
| `gemini-3-flash-preview` | `gemini-3-flash-preview` | B | 5.8 | 2,047 | 1,064 | 0 | 417 | 0 | 2,464 | 5 | sidewalk | University of Maryland, College Park / Facilities Management | Yes |
| `gemini-3-flash-preview` | `gemini-3-flash-preview` | C | 4.9 | 2,035 | 1,064 | 0 | 381 | 0 | 2,416 | 4 | streetlight | New York City Department of Transportation / Division of Street Lighting | Yes |
| `gemini-3-flash-preview` | `gemini-3-flash-preview` | D | 8.1 | 2,054 | 1,080 | 0 | 564 | 0 | 2,618 | 5 | road_damage | Prince George's County / Department of Public Works and Transportation (DPW&T) | Yes |
| `gemini-3.5-flash` | `gemini-3.6-flash` | A | 7.3 | 2,156 | 1,080 | 376 | 416 | 0 | 2,948 | 4 | pothole | Maryland Department of Transportation State Highway Administration / District 3 | Yes |
| `gemini-3.6-flash` | `gemini-3.6-flash` | A | 12.9 | 2,455 | 1,080 | 1,074 | 510 | 16,979 | 21,018 | 3 | pothole | Maryland Department of Transportation State Highway Administration / District 3 | Yes |
| `gemini-3.5-flash` | `gemini-3.6-flash` | B | 20.8 | 2,486 | 1,064 | 761 | 204 | 0 | 3,451 | 22 | sidewalk | University of Maryland / Department of Facilities Management | Yes |
| `gemini-3.6-flash` | `gemini-3.6-flash` | B | 17.4 | 2,246 | 1,064 | 664 | 212 | 0 | 3,122 | 23 | sidewalk | University of Maryland / Facilities Management | Yes |
| `gemini-3.5-flash` | `gemini-3.6-flash` | C | 8.6 | 2,195 | 1,064 | 842 | 441 | 0 | 3,478 | 4 | streetlight | New York City Department of Transportation / Division of Traffic Operations | Yes |
| `gemini-3.6-flash` | `gemini-3.6-flash` | C | 9.9 | 2,664 | 1,064 | 641 | 446 | 0 | 3,751 | 8 | streetlight | New York City Department of Transportation / Division of Traffic Operations | Yes |
| `gemini-3.5-flash` | `gemini-3.6-flash` | D | 15.7 | 2,554 | 1,080 | 1,017 | 607 | 16,514 | 20,692 | 7 | road_damage | Prince George's County Department of Public Works and Transportation / Office of Highway Maintenance | Yes |
| `gemini-3.6-flash` | `gemini-3.6-flash` | D | 12.5 | 2,354 | 1,080 | 968 | 591 | 0 | 3,913 | 7 | road_damage | Prince George's County / Department of Public Works and Transportation, Office of Highway Maintenance, Road Maintenance Division | Yes |
| `gemini-3.1-pro-preview` | `gemini-3.1-pro-preview` | A | 12.7 | 2,147 | 1,080 | 842 | 389 | 0 | 3,378 | 2 | pothole | Maryland Department of Transportation / State Highway Administration | Yes |
| `gemini-pro-latest` | `gemini-3.1-pro-preview` | A | 20.7 | 2,879 | 1,080 | 1,758 | 366 | 0 | 5,003 | 3 | pothole | Maryland Department of Transportation State Highway Administration / Office of Maintenance | Yes |
| `gemini-3.1-pro-preview` | `gemini-3.1-pro-preview` | B | 46.4 | 3,007 | 1,064 | 1,479 | 201 | 0 | 4,687 | 22 | sidewalk | University of Maryland / Facilities Management | Yes |
| `gemini-pro-latest` | `gemini-3.1-pro-preview` | B | 43.7 | 2,577 | 1,064 | 699 | 332 | 84,005 | 87,613 | 16 | sidewalk | University of Maryland / Facilities Management | Yes |
| `gemini-3.1-pro-preview` | `gemini-3.1-pro-preview` | C | 12.4 | 2,146 | 1,064 | 878 | 331 | 0 | 3,355 | 2 | streetlight | City of New York / Department of Transportation | Yes |
| `gemini-pro-latest` | `gemini-3.1-pro-preview` | C | 19.7 | 2,414 | 1,064 | 1,046 | 262 | 0 | 3,722 | 6 | streetlight | New York City Department of Transportation / Division of Street Lighting Engineering | Yes |
| `gemini-3.1-pro-preview` | `gemini-3.1-pro-preview` | D | 21.5 | 2,410 | 1,080 | 1,150 | 874 | 31,279 | 35,713 | 2 | road_damage | Prince George's County Department of Public Works and Transportation / Road Maintenance and Road Construction Division | Yes |
| `gemini-pro-latest` | `gemini-3.1-pro-preview` | D | 25.7 | 2,751 | 1,080 | 1,284 | 487 | 0 | 4,522 | 7 | road_damage | Prince George's County Department of Public Works & Transportation / Office of Highway Maintenance | Yes |
| `gemini-3.7-flash` | `gemini-3.8-flash` | A | 13.2 | 2,041 | 1,080 | 0 | 535 | 0 | 2,576 | 9 | pothole | Maryland Department of Transportation State Highway Administration / District 3 (Laurel Shop) | Yes |
| `gemini-3.8-flash` | `gemini-3.8-flash` | A | 16.7 | 2,041 | 1,080 | 0 | 761 | 21,014 | 23,816 | 7 | pothole | Maryland Department of Transportation State Highway Administration / District 3 (Laurel Maintenance Facility) | Yes |
| `gemini-flash-latest` | `gemini-3.8-flash` | A | 10.3 | 2,041 | 1,080 | 0 | 479 | 0 | 2,520 | 4 | pothole | Maryland Department of Transportation State Highway Administration / District 3 | Yes |
| `gemini-3.7-flash` | `gemini-3.8-flash` | B | 40.1 | 2,047 | 1,064 | 0 | 1,153 | 98,631 | 101,831 | 37 | sidewalk | University of Maryland / Facilities Management | Yes |
| `gemini-3.8-flash` | `gemini-3.8-flash` | B | 43.2 | 2,047 | 1,064 | 0 | 471 | 0 | 2,518 | 50 | sidewalk | University of Maryland, College Park / Facilities Management | Yes |
| `gemini-flash-latest` | `gemini-3.8-flash` | B | 37.5 | 2,047 | 1,064 | 0 | 715 | 0 | 2,762 | 38 | sidewalk | University of Maryland, College Park / Facilities Management | Yes |
| `gemini-3.7-flash` | `gemini-3.8-flash` | C | 23.7 | 2,406 | 1,064 | 1,264 | 415 | 0 | 4,085 | 10 | streetlight | New York City Department of Transportation / Division of Traffic Operations | Yes |
| `gemini-3.8-flash` | `gemini-3.8-flash` | C | 48.8 | 3,630 | 1,064 | 2,191 | 465 | 41,745 | 48,031 | 39 | streetlight | New York City Department of Transportation / Division of Traffic Operations | Yes |
| `gemini-flash-latest` | `gemini-3.8-flash` | C | 35.8 | 2,035 | 1,064 | 0 | 521 | 31,351 | 33,907 | 21 | streetlight | New York City Department of Transportation / Division of Traffic Operations | Yes |
| `gemini-3.7-flash` | `gemini-3.8-flash` | D | 19.7 | 2,054 | 1,080 | 0 | 616 | 15,335 | 18,005 | 5 | road_damage | Prince George's County Department of Public Works and Transportation / Office of Highway Maintenance, Road Maintenance and Road Construction Division | Yes |
| `gemini-3.8-flash` | `gemini-3.8-flash` | D | 9.6 | 2,054 | 1,080 | 0 | 577 | 0 | 2,631 | 2 | road_damage | Prince George's County Department of Public Works and Transportation / Office of Highway Maintenance, Road Maintenance Division | Yes |
| `gemini-flash-latest` | `gemini-3.8-flash` | D | 17.6 | 2,054 | 1,080 | 0 | 536 | 0 | 2,590 | 6 | road_damage | Prince George's County Department of Public Works and Transportation / Office of Highway Maintenance, Road Maintenance and Road Construction Division | Yes |
| `gemini-4-argon` | `gemini-4-argon` | A | 78.6 | 2,359 | 1,080 | 0 | 1,661 | 0 | 4,020 | 14 | pothole | Maryland Department of Transportation State Highway Administration (MDOT SHA) / District 3 Office (Laurel Maintenance Shop) | Yes |
| `gemini-4-argon` | `gemini-4-argon` | B | over 180 | | | | | | | | | No answer: timed out after 180 s | No |
| `gemini-4-argon` | `gemini-4-argon` | C | 55.6 | 2,353 | 1,064 | 0 | 1,235 | 0 | 3,588 | 9 | streetlight | New York City Department of Transportation / Division of Traffic Operations, Street Lighting Unit | Yes |
| `gemini-4-argon` | `gemini-4-argon` | D | 80.9 | 2,372 | 1,080 | 0 | 2,569 | 0 | 4,941 | 17 | road_damage | Prince George's County Department of Public Works and Transportation / Office of Highway Maintenance, Road Maintenance and Road Construction Division | Yes |

Calls that failed before answering (cases A–C; case D was only run on models that worked):

| Model | Error |
|---|---|
| `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro` | "This model … is no longer available to new users." |
| `gemini-omni-flash-preview`, `gemini-omni-1.1-flash`, `gemini-omni-1.2-flash` | "Search as tool is not enabled for this model" |
