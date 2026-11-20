import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const builder = readFileSync(new URL('../copper-custom-builder.js', import.meta.url), 'utf8');
const reportHelpers = builder.slice(builder.indexOf('const reportCss'), builder.indexOf("(function(){\n'use strict';"));
const dashboard = readFileSync(new URL('../copper-employee-dashboard.js', import.meta.url), 'utf8');

function openQuestionnaire() {
  const events = {};
  const content = {
    querySelector: () => null,
    addEventListener: (type, listener) => { events[type] = listener; }
  };
  const root = {
    appendChild() {},
    querySelector: (selector) => selector === '#cc-content' ? content : null
  };
  const submissions = [];
  const page = runInNewContext(reportHelpers + builder.slice(builder.indexOf("(function(){\n'use strict';"), builder.indexOf("back.addEventListener('click'")) + `
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
    document: { createElement: () => ({}), getElementById: () => root, addEventListener() {} },
    fetch: async (_url, options) => {
      submissions.push(JSON.parse(options.body));
      return { ok: false, json: async () => ({ error: 'Local test response' }) };
    },
    URL, window: {}
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
  assert.match(intro, /cc-assurance-aside"><strong>Atomic Assurance/);
  assert.doesNotMatch(intro, /\$100|Add Atomic Assurance|Continue Without Atomic Assurance|Preview a sample report|cc-atomic-assurance/);
  const review = page.reviewHtml();
  assert.match(review, /Atomic Assurance — \$100/);
  assert.match(review, /Add Atomic Assurance — \$100/);
  assert.match(review, /Continue Without Atomic Assurance/);
  assert.match(review, /What the package covers/);
  assert.match(review, /Preview a sample report/);
  assert.match(review, /Build Documentation/);
  assert.match(review, /View torque documentation/);
  assert.match(review, /View witness marking photos/);
  assert.match(review, /View test-fire footage/);
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

test('employee reports require a request and print escaped fields and HTTPS links', () => {
  const features = runInNewContext(reportHelpers + builder.slice(builder.indexOf('function assuranceRequested('),
    builder.indexOf('function renderAnswers(')) +
    '\n({ assuranceRequested, assuranceLink, assuranceReportHtml })', {
    URL,
    escape: value => String(value ?? '').replace(/[<>&"]/g,
      char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char])
  });
  assert.equal(features.assuranceRequested({ documentation_package_requested: true }), true);
  assert.equal(features.assuranceRequested({ documentation_package_requested: false }), false);
  assert.equal(features.assuranceRequested({ summary: [] }), false);
  assert.equal(features.assuranceLink('https://www.dropbox.com/scl/fi/example?dl=0'),
    'https://www.dropbox.com/scl/fi/example?dl=0');
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com']) {
    assert.equal(features.assuranceLink(url), '');
  }
  const html = features.assuranceReportHtml({ customer_name: '<b>Example</b>', id: 'example' }, {
    torque_url: 'https://example.com/torque',
    witness_url: 'https://example.com/witness',
    footage_url: 'https://example.com/video',
    target_url: 'https://example.com/target',
    test_summary: '<script>example</script>',
    sound_reading_db: 0
  });
  assert.match(html, /&lt;b&gt;Example&lt;\/b&gt;/);
  assert.match(html, /&lt;script&gt;example&lt;\/script&gt;/);
  assert.match(html, /0 dB/);
  assert.equal((html.match(/href="https:\/\/example.com\//g) ?? []).length, 4);
});

test('staff can create and edit a report without overwriting a newer revision', async () => {
  const save = {};
  const print = {};
  const email = {};
  const status = {};
  const listeners = new Map();
  const inputs = new Map();
  const body = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    querySelector(selector) {
      if (selector === '[data-assurance-save]') return save;
      if (selector === '[data-assurance-print]') return print;
      if (selector === '[data-assurance-email]') return email;
      if (selector === '[data-assurance-status]') return status;
      if (!inputs.has(selector)) inputs.set(selector, { value: '', validity: { valid: true } });
      return inputs.get(selector);
    },
    querySelectorAll() { return [...inputs.values()]; }
  };
  for (const button of [save, print, email]) {
    button.addEventListener = (type, listener) => { button[type] = listener; };
  }
  const panel = { querySelector: () => body, isConnected: true, dataset: {} };
  const requests = [];
  const responses = [[], [{ revision: 1 }], [{ revision: 2 }], []];
  const open = runInNewContext(builder.slice(builder.indexOf('function assuranceRequested('),
    builder.indexOf('function renderAnswers(')) + '\nopenAssuranceEditor', {
    URL, escape: value => String(value), $: () => panel,
    table: (name, query) => name + (query ? '?' + query : ''),
    authorizedRequest: async (path, options) => {
      requests.push({ path, options });
      return responses.shift();
    }
  });
  await open({ id: 'demo' });
  assert.equal(print.disabled, true);
  body.querySelector('#cc-assurance-footage_url').value = 'https://example.com/video';
  listeners.get('input')();
  await save.click();
  assert.equal(requests[1].options.method, 'POST');
  assert.equal(requests[1].options.body.footage_url, 'https://example.com/video');
  assert.equal(print.disabled, false);
  assert.equal(panel.dataset.dirty, 'false');
  listeners.get('input')();
  await save.click();
  assert.match(requests[2].path, /revision=eq\.1$/);
  assert.equal(requests[2].options.body.revision, 2);
  listeners.get('input')();
  await save.click();
  assert.match(requests[3].path, /revision=eq\.2$/);
  assert.match(status.textContent, /Another employee changed this report/);
  assert.equal(panel.dataset.dirty, 'true');
  assert.equal(print.disabled, true);
});
