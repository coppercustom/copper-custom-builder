# Production rollout status

November 20, 2026. Production rollout authorized. The live search v16 and intake v9 bundle hashes matched the read-only snapshots in [hosted staging evidence](hosted-validation.md).

- Applied the additive `cc_public_request_limits` migration. Verified RPC execution is denied to anon and authenticated roles and allowed to the service role.
- Deployed the staged public search candidate as production v17. Search returned 60 categories before release and 60 after release for the apex site Origin, the www Origin, and a caller without Origin.
- Production search is using the bounded shared fallback of 180 requests per minute. The three smoke checks recorded three shared-bucket attempts. Gateway identity is pending the `TRUST_MANAGED_GATEWAY_IP=true` Edge configuration.
- Production intake remains on v9 pending the separate `CONSULTATION_RATE_LIMIT_SALT` Edge secret. No live consultation or Gmail test message was generated. The OpenCart frontend and existing consultation destinations were left in place.
- Operational alert delivery is a separate follow-up. Keep alerts out of the consultation sales inbox.

Continue from the [release runbook](README.md) after securely configuring the Edge secrets. For rollback, redeploy the captured search v16 bundle. Its existing limiter was preserved.

## Intake rollout and gateway verification

After the production Edge configuration was saved, a search smoke request returned 60 categories and recorded a gateway bucket in the current database window. The prior intake bundle was active as v10 with the same hash as v9. Captured it for rollback and deployed the staged intake bundle as v11 with its existing public JWT setting.

- Both production origins passed intake preflight with 204.
- A missing Turnstile token returned 400. A synthetic invalid token reached the limiter and Turnstile, then returned 403. The database recorded a gateway bucket and zero rows matching the synthetic smoke fixture.
- These live checks stopped before inserting a consultation or attempting email delivery. Successful submission and simulated mail delivery passed in hosted staging. A successful customer submission and Gmail delivery have not been exercised in production by this rollout.
- Operational email alert delivery is still pending. Production intake rollback is to redeploy the captured prior bundle, with hash `9e7916b6c8a9770ff0c42432f7a8e2f86046ad33a3e4f33d465bb13da3ea5beb`.

## Live OpenCart submission

The operator updated the OpenCart script pin to [the final-step Turnstile fix](https://github.com/coppercustom/copper-custom-builder/commit/b02770115ef732af0640241210af966b084b2c71) and submitted a labeled test through the live builder. At 8:55 a.m. Central on November 20, production stored the consultation with status `New`. The Edge gateway logged HTTP 201, and the surrounding function logs contained no notification failure. Receipt in the Sales inbox still requires mailbox confirmation.
