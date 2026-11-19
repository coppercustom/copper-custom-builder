# Copper Custom security staging

Tracked by [issue #1](https://github.com/coppercustom/copper-custom-builder/issues/1) and [issue #2](https://github.com/coppercustom/copper-custom-builder/issues/2). The candidates are outside the normal Supabase deployment directory and have no automatic deployment workflow. Sources are based on deployed search v16 and intake v9. Intake v9 already has a 10-second OAuth refresh timeout. This candidate preserves it and the existing Gmail timeout, adds a five-second Turnstile timeout and handles verification outages separately from rejected or replayed challenges.

## Limits

| Endpoint | Window | Verified client | Missing identity, shared | Total per endpoint |
| --- | ---: | ---: | ---: | ---: |
| Public search | 60 seconds | 60 | 180 | 1,200 |
| Consultation intake | 300 seconds | 5 | 20 | 120 |

These are initial staging limits. Compare them with peak legitimate traffic before release, including offices behind shared NAT and rapid builder interactions. Fixed windows allow brief bursts across a boundary. The PostgreSQL transaction serializes updates per endpoint and stops writing counters when a cap is reached. It prunes the previous window on the next request per endpoint. An idle endpoint retains at most its last window's capped set until its next request. Counters contain keyed hashes or fixed bucket names.

Only enable `TRUST_MANAGED_GATEWAY_IP=true` on a path where the managed gateway validates `CF-Connecting-IP` and there is no alternate direct path. The [prior managed gateway probe](https://github.com/coppercustom/copper-custom-builder/issues/1#issuecomment-7025334828) found that forged Cloudflare IPs were rejected and forwarded IPs did not change the accepted Cloudflare IP on the tested path. Untrusted, missing, malformed and multi-value identities use the shared fallback. Origin controls browser access and carries no authentication weight. Search uses the same allowed origins and allows calls without an Origin or user JWT.

Rate-limit warnings identify the endpoint and gateway/shared bucket type. Verification, limiter and email failures use fixed log events. Build alerts from aggregate 429 and 503 rates and limiter RPC latency. Establish thresholds from staging and production traffic baselines before enabling notifications. Never include IPs, tokens, request content or email addresses in log alerts.

## Local test evidence

- Node 24.22.3, `node --test tests/*.test.mjs security/staging/handlers.test.mjs`. 26 passed, including 18 existing model tests and eight tests loading the actual candidate handlers with synthetic inputs and mocked network and writes. Checked browser-style and non-browser search headers, malformed and missing gateway identity, 429 and Retry-After, request size boundaries, Turnstile replay, upstream timeout and intake persistence on OAuth timeout.
- Disposable PostgreSQL 18.7, `node --test security/staging/limiter.test.mjs` with the `pg` driver. Five passed, including concurrent bursts through up to 20 pool connections, per-client and shared limits, cleanup at rollover, and RPC and table permissions. Use a fresh loopback-only PostgreSQL instance for each run. The test creates fixture roles and a fixture database. Optional variables are `COPPER_TEST_PG_DRIVER`, `COPPER_TEST_PG_PORT` (defaults to 55439) and `COPPER_TEST_PG_PASSWORD`.
- Deno 2.9.6 checked both TypeScript entrypoints using an installed Supabase JS v2 dependency and Node type definitions.

## Hosted staging and release

1. Use a separate Supabase project or preview branch with its own credentials. The current project rejected Branching because it requires Pro or above. Use only synthetic consultation records, catalog fixtures and a test notification sink. Keep live Gmail OAuth credentials and supplier sync jobs out of staging.
2. Apply the migration in `migrations/` to staging. Deploy both candidates with the shared module and JWT verification disabled for these public entrypoints. Use a separate random `CONSULTATION_RATE_LIMIT_SALT` of at least 32 characters and stage-only credentials. Search uses `BUILDER_RATE_LIMIT_SALT` and the Supabase named default secret API key as before. Use an isolated Turnstile widget or a controlled verifier for staging. A browser staging origin requires an explicit staging-only origin and hostname configuration when it differs from the production origins.
3. Confirm the hosted REST RPC resolves for the server role and is inaccessible to anon and authenticated users. Recheck gateway trust on the actual staging URL before enabling trusted identity. Confirm both normal browser and no-Origin search, synthetic successful intake and email handling, and 429/503 responses. Check caps against representative traffic and confirm alerts reach the intended destination. Test rollback on staging.
4. Before production approval, capture the exact currently deployed bundles, settings and rollback credentials, and compare versions with this candidate's bases. Apply the additive migration first, then deploy each function and smoke-test separately only after approval. If rollback is needed, redeploy the captured bundles with their original configuration. The migration adds independent objects that the previous handlers do not depend on, so schema removal is unnecessary for immediate rollback. Leave the previous search limiter in place until rollback is no longer needed.
5. The legacy `copper-gmail-oauth` endpoint is a separate cleanup in issue #1. Confirm callers and traffic, then obtain approval before disabling it.
