# Atomic Assurance

Atomic Assurance is an optional consultation add-on at a flat $100 USD. The OpenCart questionnaire briefly mentions the package on the welcome screen. The final step shows the price, previews the sample report, and asks the customer to add or decline the package. The Copper Custom representative arranges payment directly. The questionnaire only records a consultation preference.

Change the amount and currency in the `atomicAssurance` configuration in `copper-custom-builder.js`. The submitted `answers.documentation_package_requested` flag records the choice. The first row in `answers.summary` records the customer-facing status and the price shown when a request was made. The existing notification and recap formatters read that summary. The employee inbox shows the status on the consultation card, and the existing answers view and print report include the summary row. Older records without that row continue to render without an Atomic Assurance status.

The inline sample report contains fictional records. Its three sample links are illustrative and stay on the current page.

Run `node --test tests/atomic-assurance.test.mjs` to verify the choices, submission data, and inbox display locally. During an approved rollout, check both choices through the hosted questionnaire and verify the saved record and notification.

## Staff report workflow

Open a consultation marked **Atomic Assurance: Requested** and expand **Atomic Assurance Build Report**. Enter the build reference, preparer, pickup and warranty dates, test date, inspection and test summaries, and the sound reading where applicable. Paste HTTPS sharing links for the torque document, witness-marking photos, test-fire footage, and target. Dropbox and other file hosts work with the same fields. Check each link with the intended recipient's permissions before sharing a report.

Save as you go. The dashboard keeps one report per consultation and flags concurrent edits. Use **Preview / print report** to open the saved customer-facing copy and print or save it as a PDF. Internal consultation notes are excluded. Customer submissions and notifications do not read this table.

For rollout, apply `supabase/migrations/202611200002_atomic_assurance_reports.sql` after the existing consultation Trash migration. Then point the customer and staff OpenCart loaders at the approved builder revision. Verify a requested consultation, staff save and reopen, preview links and print, and confirm a declined consultation has no editor.
