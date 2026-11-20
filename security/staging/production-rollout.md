# Production rollout status

November 20, 2026. Production rollout authorized. The live search v16 and intake v9 bundle hashes matched the read-only snapshots in [hosted staging evidence](hosted-validation.md).

- Applied the additive `cc_public_request_limits` migration. Verified RPC execution is denied to anon and authenticated roles and allowed to the service role.
- Deployed the staged public search candidate as production v17. Search returned 60 categories before release and 60 after release for the apex site Origin, the www Origin, and a caller without Origin.
- Production search is using the bounded shared fallback of 180 requests per minute. The three smoke checks recorded three shared-bucket attempts. Gateway identity is pending the `TRUST_MANAGED_GATEWAY_IP=true` Edge configuration.
- Production intake remains on v9 pending the separate `CONSULTATION_RATE_LIMIT_SALT` Edge secret. No live consultation or Gmail test message was generated. The OpenCart frontend and existing consultation destinations were left in place.
- Operational alert delivery is a separate follow-up. Keep alerts out of the consultation sales inbox.

Continue from the [release runbook](README.md) after securely configuring the Edge secrets. For rollback, redeploy the captured search v16 bundle. Its existing limiter was preserved.
