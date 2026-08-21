# Performance report — baseline

- Head SHA: `15932fbeb8dbb42aef36eb7e3ca6b83a42c8aada`
- Workflow: `Validate game #1049`
- Run ID: `30551208657`
- Playwright artifact: `8763122037`
- Full-flow timeout unchanged: `480000 ms`

| Profile | Full-flow duration | Within limit |
|---|---:|---:|
| desktop-chromium | 305160 ms | yes |
| iphone-portrait | 476129 ms | yes |
| iphone-landscape | 363913 ms | yes |

## Probe status

The checkout/browser probe could not be executed in the agent runtime because outbound DNS access to GitHub was unavailable. The following values are therefore intentionally not inferred and remain unmeasured:

- DPR;
- internal renderer resolution;
- audio resource timing;
- frame-time p50/p95.

The full-flow values above are extracted directly from the successful Chromium Playwright report artifact for workflow #1049.
