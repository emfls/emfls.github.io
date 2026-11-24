import { PLANS, compareRepayment } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('loan-form');
const plan = byId('plan');
const includePG = byId('include-pg');
const pgFields = byId('pg-fields');
const target = byId('target');
const results = byId('results');
const error = byId('input-error');
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const money = (pence) => gbp.format(pence / 100);
const number = (id) => byId(id).valueAsNumber;

const interestNotes = {
  '1': 'Editable assumption. Plan 1 normally uses the lower of RPI and Bank Rate plus 1%.',
  '2': 'Editable long-term assumption. Plan 2 usually uses RPI plus up to 3%.',
  '4': 'Editable assumption. Plan 4 normally uses the lower of RPI and Bank Rate plus 1%.',
  '5': 'Editable RPI assumption. Plan 5 normally uses RPI and may be subject to a lower market-rate cap.',
  pg: 'Editable assumption. Postgraduate interest normally uses RPI plus 3%, subject to caps.'
};

function row(label, values, textColumns = 0) {
  const tr = document.createElement('tr');
  const header = document.createElement('th');
  header.scope = 'row';
  header.textContent = label;
  tr.append(header);
  values.forEach((value, index) => {
    const cell = document.createElement('td');
    if (index >= textColumns) cell.className = 'amount';
    cell.textContent = value;
    tr.append(cell);
  });
  return tr;
}

function outcome(scenario) {
  if (scenario.writtenOff) return `${money(scenario.writtenOff)} written off`;
  if (scenario.payoffMonth === 0) return 'Paid off immediately';
  if (scenario.payoffMonth === null) return 'No outstanding balance';
  const year = 2026 + Math.floor((scenario.payoffMonth - 1) / 12);
  return `Paid off in ${year}/${String(year + 1).slice(-2)} (forecast month ${scenario.payoffMonth})`;
}

function renderForecast(comparison, loans, targetIndex) {
  const { loans: compared, requested, applied, savings, salaries } = comparison;
  const repaymentRows = [];
  const lifetimeRows = [];
  const totals = { monthly: 0, annualPAYE: 0, annualFormula: 0 };
  const payrollKeys = Object.keys(totals);

  compared.forEach(({ planId, current, baseline, withOverpayment }, index) => {
    const name = PLANS[planId].name;
    repaymentRows.push(row(name, payrollKeys.map((key) => money(current[key]))));
    payrollKeys.forEach((key) => { totals[key] += current[key]; });
    lifetimeRows.push(row(name + ' · payroll only', [outcome(baseline), money(baseline.totalCost)], 1));
    if (applied && index === targetIndex) {
      lifetimeRows.push(row(name + ' · with lump sum', [outcome(withOverpayment), money(withOverpayment.totalCost)], 1));
    }
  });
  if (compared.length === 2) repaymentRows.push(row('Combined', payrollKeys.map((key) => money(totals[key]))));
  byId('repayment-rows').replaceChildren(...repaymentRows);
  byId('lifetime-rows').replaceChildren(...lifetimeRows);
  byId('payroll-summary').textContent = `Estimated payroll deduction of ${money(totals.monthly)} a month, or ${money(totals.annualPAYE)} over 12 equal months.`;

  const dualActive = compared.length === 2 && loans.every(({ balance, years }) => balance > 0 && years > 0);
  byId('marginal-rate').hidden = !dualActive;
  if (dualActive) {
    byId('marginal-rate').textContent = 'With both loans active, earnings above both thresholds face a combined 15% marginal loan deduction (9% + 6%) before payroll rounding, in addition to Income Tax and National Insurance.';
  }

  const { baseline, withOverpayment } = compared[targetIndex];
  let verdict = baseline.writtenOff > 0
    ? 'Payroll alone leaves a balance scheduled for write-off. Check whether an extra payment would reduce your future deductions before spending the cash.'
    : 'Enter a lump sum to compare the total cost with payroll repayments alone.';
  if (applied) {
    if (savings > 0) {
      verdict = `The lump sum saves ${money(savings)} in projected lifetime cash payments.`;
      if (baseline.writtenOff) verdict += ' Payroll alone still reaches write-off, so the saving depends on the lump sum clearing enough debt to cut later deductions.';
    } else if (savings < 0) {
      verdict = `Avoid this overpayment under these assumptions. It would cost ${money(-savings)} extra.`;
      if (baseline.paid === withOverpayment.paid) verdict += ' Your future payroll deductions stay the same.';
    } else {
      verdict = 'The lump sum leaves your projected lifetime cash cost unchanged.';
    }
  }
  if (requested > applied) {
    verdict += ` The model applies ${money(applied)} and leaves ${money(requested - applied)} unspent, limited to the outstanding balance eligible for repayment.`;
  }
  byId('verdict').textContent = verdict;

  const scenarios = ['baseline', 'withOverpayment'];
  const columns = ['deductions', 'writtenOff', 'balance'];
  const nYears = Math.max(...compared.flatMap((loan) => scenarios.map((key) => loan[key].rows.length)));
  const rows = salaries.slice(0, nYears).map((salary, index) => {
    const sum = (key, column) => compared.reduce((total, loan) => total + (loan[key].rows[index]?.[column] ?? 0), 0);
    const year = 2026 + index;
    const amounts = scenarios.flatMap((key) => columns.map((column) => money(sum(key, column))));
    return row(`${year}/${String(year + 1).slice(-2)}`, [money(salary), ...amounts]);
  });
  byId('forecast-rows').replaceChildren(...rows);
  const openingNote = applied ? `Lump sum of ${money(applied)} applied at the start of the forecast. ` : '';
  const immediateWriteOff = compared.reduce((total, loan) => total + (loan.baseline.rows.length ? 0 : loan.baseline.writtenOff), 0);
  const writeOffNote = immediateWriteOff ? `${money(immediateWriteOff)} is due for write-off at the start of the forecast. ` : '';
  byId('schedule-note').textContent = openingNote + writeOffNote + (rows.length
    ? 'Payroll figures exclude the lump sum. Closing balances are shown after any write-off.'
    : 'No future payroll periods are projected.');
}

function update() {
  const postgraduate = plan.value !== 'pg' && includePG.checked;
  byId('toggle-wrap').hidden = plan.value === 'pg';
  pgFields.hidden = pgFields.disabled = !postgraduate;
  byId('target-wrap').hidden = target.disabled = !postgraduate;

  const invalid = Array.from(form.elements).find((field) => field.willValidate && !field.validity.valid);
  if (invalid) {
    results.hidden = true;
    error.hidden = false;
    const label = invalid.labels[0].textContent;
    const precision = invalid.step === '1' ? ' as a whole number' : ' with up to two decimal places';
    error.textContent = `Enter ${label.toLowerCase()} between ${invalid.min} and ${invalid.max}${precision}.`;
    return;
  }

  const loans = [{ planId: plan.value, balance: number('balance'), years: number('years'), interest: number('interest') }];
  if (postgraduate) {
    loans.push({ planId: 'pg', balance: number('pg-balance'), years: number('pg-years'), interest: number('pg-interest') });
  }
  const targetIndex = postgraduate ? Number(target.value) : 0;
  const comparison = compareRepayment({
    salary: number('salary'), growth: number('growth'), loans,
    lumpSum: byId('lump-sum').value === '' ? 0 : number('lump-sum'), target: targetIndex
  });
  renderForecast(comparison, loans, targetIndex);
  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', (event) => {
  if (event.target === plan) {
    const selected = PLANS[plan.value];
    byId('years').max = selected.maxYears ?? selected.years;
    byId('years').value = selected.years;
    byId('interest').value = selected.interest;
    byId('interest-note').textContent = interestNotes[plan.value];
  }
  update();
});
form.addEventListener('submit', (event) => event.preventDefault());
update();

for (const placement of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (placement.dataset.adSlot) (window.adsbygoogle = window.adsbygoogle || []).push({});
}
