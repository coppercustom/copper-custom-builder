# Hosted staging evidence

November 20, 2026. Candidate [5f1ed0e](https://github.com/coppercustom/copper-custom-builder/commit/5f1ed0ecc56d0ab2cd7c3df55dca8e4f613c7158) ran in the [isolated Free staging project](https://supabase.com/dashboard/project/bllfomhyrepvwncrqmgl). Hosted PostgreSQL reported 17.12. The limiter migration was applied as committed. A staging-only schema supplied one synthetic search category and a table constrained to the synthetic intake fixture. The Edge bundles had staging-only salts, a project-reference guard, a loopback test origin, Cloudflare test secrets, and an in-process notification sink.

| Check | Observed result |
| --- | --- |
| Public search with Chromium and CORS enabled | 200 with synthetic category |
| Public search without Origin and with the allowed www origin | 200 in both cases |
| Search with an unapproved Origin | 403 |
| Chromium synthetic consultation with Cloudflare's successful test key | 201 |
| Cloudflare fail and duplicate test keys | 403 in both cases |
| Turnstile timeout simulated in the hosted runtime | 503 with stable verification response |
| Both endpoints at the shared ceiling | 429 in both cases after seeding only the staging global counters |
| Both endpoints with limiter unavailable | 503 in both cases after temporarily revoking the staging RPC privilege |
| RPC and table via publishable key | Both denied with 401 |
| RPC role grants | Anon and authenticated denied, service role allowed |
| Staging persistence and notifications | Two synthetic rows, two notification-sink acknowledgments |
| Gateway identity on regular hosted requests | Both endpoints recorded keyed gateway buckets. The prior production-path probe remains the evidence for forwarded header handling. |
| Rollback | Prior search and intake bundles redeployed on staging with project guards. Search returned the fixture with 200 and the prior intake method guard returned 405. |
| Roll forward | Staging search v3 returned 200, intake v4 preflight returned 204, and the service role RPC privilege was confirmed restored. |

The initial negative Turnstile check used the always-pass test secret. It returned 201 and wrote a synthetic fixture row. The rerun used Cloudflare's dedicated fail and duplicate keys and got the expected 403s. The browser harness also required a headless build compatible with the runner, with Chromium web security enabled for the final smoke tests. The local runner bypassed its egress-proxy certificate error for this isolated harness.

Staging logs showed one event for each endpoint's rate limit and limiter outage, one verification outage, and two sink acknowledgments. These events support aggregate monitoring. An external notification destination and delivery test remain open. A read-only 24-hour production aggregate showed 95 search POSTs and six consultation POSTs, with peak one-minute totals of five and four, respectively. This is a short traffic sample. Review 429s and shared-network behavior after release.

Production version references were read for the rollback rehearsal. Search v16 bundle hash was `84f0ff416c445325f7e5ffad9fd3b152d697003d7283d38f2f6d97a40af2b397`. Intake v9 bundle hash was `9e7916b6c8a9770ff0c42432f7a8e2f86046ad33a3e4f33d465bb13da3ea5beb`. Recheck those versions and capture the exact rollback bundles before any approved rollout. Run the staged rollout in the [release runbook](README.md) using the unmodified candidate source and production-owned configuration. Only the limiter migration belongs in production. The staging fixtures, test keys, origin, and simulated mail sink belong to staging.

The hosted fixture tests use a loopback page and Cloudflare test keys. The live OpenCart builder, production Turnstile widget, and Gmail delivery remain production smoke checks after explicit deployment approval. Production customer data, supplier integrations, and deployment were untouched.
