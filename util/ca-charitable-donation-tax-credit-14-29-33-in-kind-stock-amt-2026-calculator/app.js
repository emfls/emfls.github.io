import { calculateDonation } from './model.mjs';

const form = document.getElementById('calculator');
const results = document.getElementById('results');
const error = document.getElementById('error');
const dollars = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });
const money = amount => dollars.format(Math.abs(amount) < .005 ? 0 : amount);

function scenarioCard(title, scenario) {
  return `<article class="scenario">
    <h3>${title}</h3>
    <dl>
      <dt>Gift and eligible receipt</dt><dd>${money(scenario.receipt)}</dd>
      <dt>Regular tax from sale before credits</dt><dd>${money(scenario.saleTax)}</dd>
      <dt>Federal tax saved</dt><dd>${money(scenario.federalSavings)}</dd>
      <dt>Provincial tax saved</dt><dd>${money(scenario.provincialSavings)}</dd>
      <dt>Combined tax saved (% of gift)</dt><dd>${money(scenario.total)} (${percent.format(scenario.effectiveRate)})</dd>
      <dt>Gift above federal annual limit</dt><dd>${money(scenario.overFederalLimit)}</dd>
      <dt>Estimated after-tax cost</dt><dd>${money(scenario.cost)}</dd>
    </dl>
  </article>`;
}

function render() {
  const { fmv, acb, taxableIncome, netIncome, province } = form.elements;
  let result;
  try {
    if (!form.checkValidity()) throw new RangeError('Enter amounts from $0 to $1 billion, with up to two decimal places.');
    result = calculateDonation({
      fmv: fmv.valueAsNumber,
      acb: acb.valueAsNumber,
      taxableIncome: taxableIncome.valueAsNumber,
      netIncome: netIncome.value === '' ? undefined : netIncome.valueAsNumber,
      province: province.value,
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  const { inKind, netCash, fullCash, gain, taxableGain, avoidedSaleTax, extraSavingsVsNetCash,
    extraSavingsVsFullCash, poolingDifference, amt } = result;
  const exemptionStatus = amt.aboveExemption ? 'Proxy exceeds the exemption' : 'Proxy is within the exemption';
  const poolingScope = province.value === 'QC' ? 'Federal only, after Québec abatement.' : 'Federal and provincial.';
  error.textContent = '';
  error.hidden = true;
  results.innerHTML = `
    <h3>Estimated regular-tax results</h3>
    <div class="comparison">
      ${scenarioCard('Give shares in-kind', inKind)}
      ${scenarioCard('Sell and give net cash', netCash)}
      ${scenarioCard('Sell and give full cash', fullCash)}
    </div>
    <div class="summary">
      <ul>
        <li>Capital gain before inclusion <strong>${money(gain)}</strong> · taxable if sold <strong>${money(taxableGain)}</strong></li>
        <li>Regular sale tax avoided with an in-kind transfer, before donation credits <strong>${money(avoidedSaleTax)}</strong></li>
        <li>In-kind cost savings vs. giving net cash <strong>${money(extraSavingsVsNetCash)}</strong> · vs. giving full cash <strong>${money(extraSavingsVsFullCash)}</strong></li>
        <li>Spousal pooling benefit vs. a 50/50 split at equal incomes <strong>${money(poolingDifference)}</strong>. ${poolingScope} A negative amount favours splitting.</li>
      </ul>
    </div>
    <aside class="summary ${amt.aboveExemption ? 'warning' : ''}" aria-labelledby="amt-title">
      <h3 id="amt-title">Federal AMT screen for the in-kind gift</h3>
      <p><strong>${exemptionStatus}.</strong> The 30% inclusion adds <strong>${money(amt.inclusion)}</strong> to taxable income, giving a proxy AMT income of <strong>${money(amt.incomeProxy)}</strong>.</p>
      <p>Gross screen before AMT credits <strong>${money(amt.gross)}</strong>, including a <strong>${money(amt.grossIncrease)}</strong> increase from the gift gain. Actual AMT payable requires Form T691.</p>
    </aside>`;
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
