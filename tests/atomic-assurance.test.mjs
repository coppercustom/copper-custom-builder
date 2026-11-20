import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const builder = readFileSync(new URL('../copper-custom-builder.js', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../copper-employee-dashboard.js', import.meta.url), 'utf8');

function openQuestionnaire() {
  const events = {};
  const content = {
    querySelector: () => null,
    addEventListener: (type, listener) => { events[type] = listener; }
  };
  const root = {
    querySelector: (selector) => selector === '#cc-content' ? content : null
  };
  const submissions = [];
  const page = runInNewContext(builder.slice(0, builder.indexOf("back.addEventListener('click'")) + `
    return {
      introHtml, reviewHtml, summaryText, validContact, submitConsultation,
      fillContact() {
        Object.assign(contact, { name: 'Example Customer', email: 'demo@example.com',
          phone: '5550101234', representativeChoice: 'first' });
        turnstileToken = 'local-test-token';
        next = {};
        back = {};
      }
    };
  })();`, {
    document: { getElementById: () => root, addEventListener() {} },
    fetch: async (_url, options) => {
      submissions.push(JSON.parse(options.body));
      return { ok: false, json: async () => ({ error: 'Local test response' }) };
    },
    window: {}
  });
  return {
    page,
    submissions,
    select(value) { events.change({ target: { name: 'cc-atomic-assurance', value } }); }
  };
}

test('the questionnaire shows the flat price, both choices, and a sample preview', () => {
  const { page } = openQuestionnaire();
  const intro = page.introHtml();
  assert.match(intro, /Atomic Assurance/);
  assert.doesNotMatch(intro, /\$100|Add Atomic Assurance|Continue Without Atomic Assurance|Preview a sample report|cc-atomic-assurance/);
  const review = page.reviewHtml();
  assert.match(review, /Atomic Assurance — \$100/);
  assert.match(review, /Add Atomic Assurance — \$100/);
  assert.match(review, /Continue Without Atomic Assurance/);
  assert.match(review, /Preview a sample report/);
  assert.match(review, /representative will arrange payment directly/);
  page.fillContact();
  assert.match(page.validContact(), /Please choose whether to add Atomic Assurance/);
});

for (const [choice, status] of [['requested', 'Requested — $100'], ['declined', 'Declined']]) {
  test(`the ${choice} selection survives a review rerender and reaches the submission summary`, async () => {
    const { page, select, submissions } = openQuestionnaire();
    page.fillContact();
    select(choice);
    assert.match(page.reviewHtml(), new RegExp(`value="${choice}" required checked`));
    assert.ok(page.summaryText().includes(`Atomic Assurance: ${status}`));
    await page.submitConsultation();
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].answers.documentation_package_requested, choice === 'requested');
    assert.deepEqual(submissions[0].answers.summary[0], { label: 'Atomic Assurance', value: status });
  });
}

test('both employee inbox scripts show the saved status and preserve legacy records', () => {
  for (const source of [builder, dashboard]) {
    const format = runInNewContext(source.slice(source.indexOf('function atomicAssuranceInbox('),
      source.indexOf('function renderAnswers(')) + '\natomicAssuranceInbox', { escape: String });
    assert.match(format({ summary: [{ label: 'Atomic Assurance', value: 'Requested — $100' }] }),
      /Atomic Assurance: Requested — \$100/);
    assert.match(format('{"summary":[{"label":"Atomic Assurance","value":"Declined"}]}'),
      /Atomic Assurance: Declined/);
    assert.equal(format({ summary: [{ label: 'An older answer', value: 'Yes' }] }), '');
    assert.equal(format('older unstructured answers'), '');
  }
});
