import { compareInvestmentIncome, OAS_THRESHOLD } from './model.mjs';

const form = document.getElementById('tax-form');
const province = document.getElementById('province');
const otherIncome = document.getElementById('other-income');
const investment = document.getElementById('investment');
const receivingOas = document.getElementById('receiving-oas');
const oasField = document.getElementById('oas-field');
const oasReceived = document.getElementById('oas-received');
const error = document.getElementById('input-error');
const results = document.getElementById('results');
const summary = document.getElementById('result-summary');
const comparison = document.getElementById('comparison');

const cad = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', signDisplay: 'negative',
});
const percent = new Intl.NumberFormat('en-CA', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'negative',
});

const scenarios = {
  eligible: 'Eligible Canadian dividends',
  nonEligible: 'Non-eligible dividends',
  capitalGains: 'Realized capital gains',
  interest: 'Interest / foreign dividends',
};

function addMetrics(list, entries) {
  for (const [label, value, key] of entries) {
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    if (key) detail.dataset.metric = key;
    list.append(term, detail);
  }
}

const cards = Object.entries(scenarios).map(([key, title]) => {
  const card = document.createElement('article');
  card.className = 'scenario';
  card.dataset.scenario = key;
  const heading = document.createElement('h3');
  heading.textContent = title;
  const metrics = document.createElement('dl');
  const details = document.createElement('details');
  const toggle = document.createElement('summary');
  toggle.textContent = 'Tax breakdown';
  const breakdown = document.createElement('dl');
  details.append(toggle, breakdown);
  card.append(heading, metrics, details);
  comparison.append(card);
  return { key, metrics, breakdown };
});

function renderScenario({ metrics, breakdown }, row) {
  metrics.replaceChildren();
  addMetrics(metrics, [
    ['Net tax owed', cad.format(row.netTax), 'net-tax'],
    ['Effective tax rate', row.effectiveTaxRate === null ? 'N/A' : percent.format(row.effectiveTaxRate), 'effective-rate'],
    ['After-tax cash kept', cad.format(row.afterTaxCash), 'after-tax'],
    ['Extra OAS repayment', receivingOas.checked ? cad.format(row.additionalRecovery) : '—', 'extra-recovery'],
  ]);
  breakdown.replaceChildren();
  addMetrics(breakdown, [
    ['Income added', cad.format(row.includedIncome), 'included-income'],
    ['Income before OAS repayment', cad.format(row.preRecoveryIncome), 'pre-recovery'],
    ['Net income (line 23600)', cad.format(row.netIncome), 'net-income'],
    ['Federal dividend credit calculated', cad.format(row.federalCredit)],
    ['Provincial dividend credit calculated', cad.format(row.provincialCredit)],
    ['Federal tax after credits', cad.format(row.federalTax)],
    ['Provincial tax after credits', cad.format(row.provincialTax)],
    ['Total OAS repayment', cad.format(row.recovery), 'total-recovery'],
    ['Total payable in scenario', cad.format(row.totalPayable)],
  ]);
}

function update() {
  oasField.hidden = !receivingOas.checked;
  oasReceived.disabled = !receivingOas.checked;
  const fields = [otherIncome, investment, oasReceived];
  let message = '';
  for (const field of fields) {
    const invalid = !field.disabled && !field.validity.valid;
    field.setAttribute('aria-invalid', String(invalid));
    if (invalid && !message) {
      message = `Enter a non-negative amount up to $1 billion with up to two decimal places for “${field.labels[0].textContent}”.`;
    }
  }
  if (!message && receivingOas.checked && oasReceived.valueAsNumber > otherIncome.valueAsNumber) {
    oasReceived.setAttribute('aria-invalid', 'true');
    message = 'Include your gross OAS in other income. Gross OAS cannot exceed other income.';
  }
  error.textContent = message;
  error.hidden = !message;
  results.hidden = Boolean(message);
  if (message) return;

  const estimate = compareInvestmentIncome({
    province: province.value,
    otherTaxableIncome: otherIncome.valueAsNumber,
    investmentCash: investment.valueAsNumber,
    receivingOas: receivingOas.checked,
    oasReceived: receivingOas.checked ? oasReceived.valueAsNumber : 0,
  });
  const eligible = estimate.scenarios.eligible;
  const baseline = `Baseline payable: ${cad.format(estimate.baseline.totalPayable)}.`;
  if (receivingOas.checked) {
    summary.textContent = `${baseline} Eligible dividends bring recovery income to ${cad.format(eligible.preRecoveryIncome)} against the ${cad.format(OAS_THRESHOLD)} threshold. Extra OAS repayment: ${cad.format(eligible.additionalRecovery)}.`;
  } else {
    summary.textContent = `${baseline} Select Receiving OAS to see how the same investment amount affects repayment.`;
  }
  for (const card of cards) renderScenario(card, estimate.scenarios[card.key]);
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
