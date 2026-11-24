import { calculateReserve } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('reserve-calculator');
const error = byId('input-error');
const results = byId('results');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent' });
const money = amount => amount === null ? 'N/A' : currency.format(amount);

function renderSchedule(schedule) {
  const rows = schedule.map(row => {
    const tr = document.createElement('tr');
    const year = document.createElement('th');
    year.scope = 'row';
    year.textContent = row.year;
    tr.append(year);
    const cells = [
      money(row.proceedsDue), money(row.unpaidProceedsAtYearEnd),
      money(row.proceedsBasedReserve), percent.format(row.reserveFactor),
      money(row.statutoryCapReserve), money(row.endingReserve),
      money(row.priorReserveAddedBack), money(row.netCapitalGainRecognized),
      money(row.taxableCapitalGain), money(row.tax),
    ];
    for (const value of cells) tr.insertCell().textContent = value;
    return tr;
  });
  byId('schedule-body').replaceChildren(...rows);
}

function update() {
  const nonResident = byId('nonResident').checked;
  const regime = byId('regime').value;
  byId('residency-warning').hidden = !nonResident;
  byId('eligibility-note').hidden = nonResident || regime !== 'intergenerational_10yr';

  let result;
  try {
    result = calculateReserve({
      saleProceeds: byId('saleProceeds').valueAsNumber,
      costBasisAndExpenses: byId('costBasisAndExpenses').valueAsNumber,
      downPayment: byId('downPayment').valueAsNumber,
      installmentYears: byId('installmentYears').valueAsNumber,
      otherIncome: byId('otherIncome').valueAsNumber,
      province: byId('province').value,
      regime,
      nonResident,
    });
  } catch (cause) {
    if (!(cause instanceof RangeError)) throw cause;
    error.textContent = cause.message;
    results.hidden = true;
    return;
  }

  error.textContent = '';
  const totals = {
    'capital-gain': result.totalCapitalGain,
    'lump-sum-tax': result.lumpSumTax,
    'cumulative-tax': result.cumulativeTax,
    'savings': result.savings,
    'cash-preserved': result.yearZeroCashPreserved,
    'year-zero-tax': result.schedule[0].tax,
    'annual-installment': result.annualInstallment,
  };
  for (const [id, amount] of Object.entries(totals)) byId(id).textContent = money(amount);

  const last = result.schedule.at(-1);
  const expiry = byId('expiry-note');
  expiry.hidden = nonResident || last.unpaidProceedsAtYearEnd === 0 || result.totalCapitalGain === 0;
  expiry.textContent = expiry.hidden ? '' :
    `The reserve has expired by ${last.year} even though ${money(last.unpaidProceedsAtYearEnd)} of principal is still due later.`;
  renderSchedule(result.schedule);
  results.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
