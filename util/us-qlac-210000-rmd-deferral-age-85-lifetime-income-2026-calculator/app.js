import { projectQLAC, QLAC_CAP_2026 } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('qlac-form');
const mode = byId('mode');
const filing = byId('filing');
const spouseFields = byId('spouse-fields');
const error = byId('input-error');
const results = byId('results');
const liveSummary = byId('live-summary');
const tableBody = byId('projection-rows');

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const ages = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const money = amount => dollars.format(Math.abs(amount) < 0.005 ? 0 : amount);

function renderRows(rows) {
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = `${row.year} / ${row.age}`;
    tr.append(heading);
    for (const value of [
      row.divisor.toFixed(1), money(row.withoutRMD), money(row.withRMD), money(row.rmdReduction),
      money(row.annuityIncome), `${money(row.withoutMAGI)} / ${row.withoutIRMAA.tier}`,
      `${money(row.withMAGI)} / ${row.withIRMAA.tier}`, row.benchmarkPremiumYear,
      money(row.annualIRMAAReduction),
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      tr.append(cell);
    }
    fragment.append(tr);
  }
  tableBody.replaceChildren(fragment);
}

function render() {
  const couple = mode.value === 'married_couple';
  spouseFields.hidden = !couple;
  spouseFields.disabled = !couple;
  for (const option of filing.options) option.disabled = (option.value === 'joint') !== couple;
  if (filing.selectedOptions[0].disabled) filing.value = couple ? 'joint' : 'single';

  const fields = Object.fromEntries([...form.querySelectorAll('input[type="number"]')]
    .filter(input => !input.matches(':disabled'))
    .map(input => [input.id, input.valueAsNumber]));
  let projection;
  try {
    projection = projectQLAC({ ...fields, mode: mode.value, filing: filing.value });
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    error.hidden = false;
    results.hidden = true;
    liveSummary.textContent = '';
    return;
  }

  const {
    birthYear, startAge, payoutAge, appliedPremium, availablePremium, ownerPremiums, annualIncome,
    firstRMDReduction, cumulativeRMDDeferred, federalTaxDeferred, netFederalTaxThrough84, breakEvenAge, rows,
  } = projection;
  const first = rows[0];
  const lowerTierYears = rows.filter(row => row.withIRMAA.tier < row.withoutIRMAA.tier).length;
  const higherTierYears = rows.filter(row => row.withIRMAA.tier > row.withoutIRMAA.tier).length;
  const legalCap = QLAC_CAP_2026 * ownerPremiums.length;

  byId('scenario').textContent =
    `Birth year ${birthYear} · RMD start age ${startAge} · First projected RMD at age ${first.age} (${first.year})`;
  const ownerSplit = couple ? ` You: ${money(ownerPremiums[0])}. Spouse: ${money(ownerPremiums[1])}.` : '';
  const capped = fields.premium > availablePremium
    ? ` Your ${money(fields.premium)} request was capped by available funds or remaining lifetime limits.`
    : '';
  byId('allocation').textContent =
    `Premium applied: ${money(appliedPremium)}. Available for a new purchase: ${money(availablePremium)} of the ${money(legalCap)} ceiling.${ownerSplit}${capped}`;
  byId('first-reduction').textContent = money(firstRMDReduction);
  byId('cumulative').textContent = money(cumulativeRMDDeferred);
  byId('tax-deferred').textContent = money(federalTaxDeferred);
  byId('tax-net').textContent = money(netFederalTaxThrough84);
  byId('income-label').textContent = `Estimated lifetime income per year from age ${payoutAge}`;
  byId('income').textContent = money(annualIncome);
  byId('break-even').textContent = breakEvenAge === null ? 'N/A' : ages.format(breakEvenAge);
  byId('irmaa-summary').textContent =
    `IRMAA benchmark: ${lowerTierYears} of ${rows.length} years in a lower tier and ${higherTierYears} in a higher tier with the QLAC. In the first projected RMD year, tier ${first.withoutIRMAA.tier} becomes tier ${first.withIRMAA.tier}, an annual surcharge reduction of ${money(first.annualIRMAAReduction)} per beneficiary.`;
  renderRows(rows);
  error.hidden = true;
  results.hidden = false;
  liveSummary.textContent =
    `First projected RMD reduction ${money(firstRMDReduction)}. Estimated lifetime income ${money(annualIncome)} per year from age ${payoutAge}.`;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();
