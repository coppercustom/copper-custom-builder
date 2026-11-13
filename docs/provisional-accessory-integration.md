# Provisional accessory catalog integration (development only)

## Existing production architecture
- OpenCart information page 16 embeds `copper-custom-builder.js` via a commit-pinned jsDelivr URL.
- The browser calls Supabase Edge Function `public-lipseys-search` for `manufacturers` and `products` with `itemType: "Optic"` or `itemType: "NFA"`.
- The same script uses `unified-firearm-*` actions for firearm selection and `submit-copper-consultation` for submission.
- Do not alter the live script URL or merge this branch before testing.

## Internal catalog
- Internal view: `public.cc_accessory_internal_provisional_catalog`, currently 2,871 optics and 439 suppressors; 3,574 linked supplier listings.
- All products remain `pending_review`; supplier presence unverified. `customer_eligible=false`.
- The view has `security_invoker=true` and SELECT revoked from `anon` and `authenticated`. Do **not** grant public read or embed a service-role key in client JavaScript.
- 678 optic listings remain unlinked due to 188 manufacturer-conflict and 151 MPN-conflict UPC groups.

## Required server-side integration
1. Create a dedicated **authorized** test-only Edge Function or authenticated OpenCart proxy. Verify access on the server for every request. A client-side toggle, secret in JavaScript, obscure URL, or public Supabase anon key is not authorization.
2. Read provisional catalog with server-side credentials only. Allowlist operations `manufacturers` and `products`; restrict category to `optic` or `suppressor`; parameterize manufacturer/search/limit/offset and cap limits. Return only safe product fields (manufacturer, model, product ID, source metadata as needed). Never return wholesale raw payload, internal audit records, or RSR pricing.
3. Distinguish **provisional** from **verified-current** results. Show a conspicuous internal-testing label. Do not silently fall back to provisional data for public visitors.
4. Wire the existing `manufacturerRequest` and `modelRequest` for optics and suppressors to the authorized endpoint **only after the test session is verified**; preserve existing public behavior otherwise. The existing `itemTypeFor` maps suppressors to `NFA`; map this explicitly to internal category `suppressor`.
5. Keep firearm actions and consultation submission unchanged. Do not send internal-only product IDs to the submission endpoint unless its schema supports them.
6. Test unauthorized access (401/403), manufacturer filtering, search/pagination, selection persistence, mobile dropdowns, supplier availability disclaimers, and rollback to the commit-pinned production script.

## Blocking input
Choose how a tester is authorized on the existing OpenCart page: an OpenCart admin/customer session validated server-side, or a separate test-login flow. The existing information page is publicly reachable, so merely placing a provisional mode switch there would expose unverified data.
