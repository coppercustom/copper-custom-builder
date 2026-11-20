# Atomic Assurance

Atomic Assurance is an optional consultation add-on at a flat $100 USD. The OpenCart questionnaire briefly mentions the package on the welcome screen. The final step shows the price, previews the sample report, and asks the customer to add or decline the package. The Copper Custom representative arranges payment directly. The questionnaire only records a consultation preference.

Change the amount and currency in the `atomicAssurance` configuration in `copper-custom-builder.js`. The submitted `answers.documentation_package_requested` flag records the choice. The first row in `answers.summary` records the customer-facing status and the price shown when a request was made. The existing notification and recap formatters read that summary. The employee inbox shows the status on the consultation card, and the existing answers view and print report include the summary row. Older records without that row continue to render without an Atomic Assurance status.

The built-in sample preview works without a PDF. OpenCart pages that already provide the sample PDF in the `cc-documentation-sample` element also show a download link.

Run `node --test tests/atomic-assurance.test.mjs` to verify the choices, submission data, and inbox display locally. During an approved rollout, check both choices through the hosted questionnaire and verify the saved record and notification.
