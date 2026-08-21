# Performance report — current

- Head SHA: `0cb496ba671c878f2e9bb08ef21d62c2686c469d`
- Workflow: `Validate game #1065`
- Run ID: `30562890016`
- Playwright artifact: `8767863070`
- Baseline SHA: `15932fbeb8dbb42aef36eb7e3ca6b83a42c8aada`
- Full-flow timeout unchanged: `480000 ms`

| Profile | Baseline | Current | Delta | Delta % | Within limit |
|---|---:|---:|---:|---:|---:|
| desktop-chromium | 305160 ms | 310909 ms | +5749 ms | +1.884% | yes |
| iphone-portrait | 476129 ms | 471340 ms | -4789 ms | -1.006% | yes |
| iphone-landscape | 363913 ms | 363042 ms | -871 ms | -0.239% | yes |

## Interpretation

- iPhone portrait improved by `4789 ms` and completed `8660 ms` below the existing `480000 ms` limit.
- iPhone landscape improved by `871 ms`.
- Desktop regressed by `5749 ms` (`1.884%`) but remained well within the unchanged limit.
- All three canonical full-flow runs completed successfully without changing the scenario or timeout.

## Probe status

The checkout/browser probe could not be executed in the agent runtime because outbound DNS access to GitHub was unavailable. The following values are therefore intentionally not inferred and remain unmeasured:

- DPR;
- internal renderer resolution;
- audio resource timing;
- frame-time p50/p95.

The full-flow values above are extracted directly from the successful Chromium Playwright report artifacts for workflows #1049 and #1065.

## A0 decision support

The available evidence supports that the portrait timeout instability did not reproduce on the current head and that desktop/landscape remained green. It does **not** yet satisfy the complete issue #84 performance contract because the dedicated probe metrics are missing.
