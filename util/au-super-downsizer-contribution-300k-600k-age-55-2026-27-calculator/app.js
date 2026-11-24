import { calculate } from './model.mjs';

const get = id => document.getElementById(id);
const form = get('calculator');
const value = id => get(id).value;
const number = id => get(id).valueAsNumber;
const yes = id => value(id) === 'yes';
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol' });
const money = amount => currency.format(amount);
const dates = new Intl.DateTimeFormat('en-AU', { dateStyle: 'long', timeZone: 'UTC' });
const unmet = {
  age: 'must be at least 55 when the fund receives payment',
  ownership: 'needs at least 10 years of continuous ownership',
  dwelling: 'needs an eligible dwelling and main residence CGT exemption',
  contract: 'needs a contract signed on or after 1 July 2018',
  timing: 'payment must reach the fund from settlement through the applicable deadline',
  form: 'give your fund NAT 75073 before or with payment',
  priorUse: 'the scheme was already used for another home sale',
};

function readMember(key) {
  return {
    age: number(key + 'Age'),
    date: value(key + 'Date'),
    formReady: yes(key + 'Form'),
    priorOtherSale: yes(key + 'PriorSale'),
    priorSameSale: number(key + 'PriorAmount'),
    extension: value(key + 'Extension'),
    personalCap: number(key + 'Cap'),
    transferBalance: number(key + 'Balance'),
    retirementPhase: yes(key + 'Retirement'),
  };
}

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function renderRows(list, rows) {
  list.replaceChildren(...rows.map(([label, text]) => {
    const row = document.createElement('div');
    row.append(element('dt', label), element('dd', text));
    return row;
  }));
}

function renderMember(member, label) {
  const section = document.createElement('section');
  const failed = Object.keys(member.gates).filter(gate => !member.gates[gate]);
  section.append(element('h3', label));
  section.append(element('p', member.eligible ? 'Eligibility checks met.' : 'Review the eligibility checks below.'));
  if (failed.length) {
    const list = document.createElement('ul');
    list.append(...failed.map(gate => element('li', unmet[gate])));
    section.append(list);
  }

  const list = document.createElement('dl');
  const timing = member.daysFromSettlement;
  renderRows(list, [
    ['Payment timing', timing === null ? 'Enter a date' : timing < 0 ? `${-timing} days before settlement` : `Day ${timing} after settlement`],
    ['Downsizer allocation', money(member.amount)],
    ['Transfer cap room', money(member.headroom)],
    ['To retirement phase', money(member.retirementAmount)],
    ['Stays in accumulation', money(member.accumulationAmount)],
  ]);
  section.append(list);
  return section;
}

function render(result, requestedRecipients) {
  get('headline').textContent = `${money(result.total)} maximum additional contribution`;
  get('deadline').textContent = `Standard 90-day deadline is ${dates.format(new Date(result.deadline))}.`;
  renderRows(get('allocation'), [
    ['Eligible proceeds left after contributions', money(result.remainingProceeds)],
    ['Contributions tax', money(result.contributionsTax)],
  ]);
  const members = get('member-results');
  members.replaceChildren(renderMember(result.a, 'Member A'));
  if (result.b) members.append(renderMember(result.b, 'Member B'));

  const pension = result.pension;
  const pensionNote = get('pension-note');
  if (pension) {
    const count = pension.recipients;
    pensionNote.textContent = `Assets-test-only estimate for ${count} ${count === 1 ? 'recipient' : 'recipients'} aged 67 or older at the entered ages. Rates as at 20 September 2026.`;
  } else {
    pensionNote.textContent = requestedRecipients === 0
      ? 'Pension estimate skipped.'
      : 'A member must be at least 67 for the pension estimate.';
  }
  renderRows(get('pension-results'), pension ? [
    ['Full-rate assets threshold', money(pension.threshold)],
    ['New assessable super', money(pension.assessableAdded)],
    ['Before new contribution / fortnight', money(pension.before)],
    ['After new contribution / fortnight', money(pension.after)],
    ['Estimated loss / fortnight', money(pension.fortnightlyLoss)],
    ['Estimated loss / 26 fortnights', money(pension.annualLoss)],
  ] : []);
  renderRows(get('return-results'), [
    ['Gross investment earnings', money(result.returns.gross)],
    ['After tax in super', money(result.returns.afterSuperTax)],
    ['After tax outside super', money(result.returns.afterOutsideTax)],
    ['Annual earnings advantage in super', money(result.returns.taxBenefit)],
  ]);
}

function update() {
  const household = value('household');
  const couple = household === 'couple';
  get('member-b').hidden = !couple;
  get('member-b').disabled = !couple;
  get('split-field').hidden = !couple;
  get('shareA').disabled = !couple;
  get('split-note').hidden = !couple;

  const recipientField = get('pensionRecipients');
  recipientField.options[2].disabled = !couple;
  if (!couple && recipientField.value === '2') recipientField.value = '1';
  const pensionRecipients = Number(recipientField.value);
  get('otherAssets').disabled = pensionRecipients === 0;

  const results = get('results');
  const error = get('error');
  try {
    const invalid = Array.from(form.elements).find(field => field.willValidate && !field.validity.valid);
    if (invalid) throw new RangeError(`${invalid.labels[0].textContent}. ${invalid.validationMessage}`);

    render(calculate({
      household,
      proceeds: number('proceeds'),
      contract: value('contract'),
      settlement: value('settlement'),
      yearsOwned: number('yearsOwned'),
      qualifyingHome: yes('qualifyingHome'),
      shareA: number('shareA'),
      homeowner: yes('homeowner'),
      otherAssets: number('otherAssets'),
      grossReturn: number('grossReturn'),
      outsideTax: number('outsideTax'),
      pensionRecipients,
      a: readMember('a'),
      b: couple ? readMember('b') : null,
    }), pensionRecipients);
    results.hidden = false;
    error.hidden = true;
    error.textContent = '';
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    error.hidden = false;
    error.textContent = issue.message;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
