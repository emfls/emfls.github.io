import { calculateMortgage } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('mortgage-form');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const money = value => currency.format(value);
const percent = value => `${value.toFixed(2)}%`;
const write = (id, value) => { byId(id).textContent = value; };
const numericFields = [...form.querySelectorAll('input[type="number"]')];

function update() {
  const invalid = numericFields.filter(field => !field.validity.valid);
  for (const field of numericFields) {
    if (invalid.includes(field)) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }

  let result;
  try {
    if (invalid.length) {
      const field = invalid[0];
      throw new RangeError(`${field.labels[0].textContent}. ${field.validationMessage}`);
    }

    const numbers = Object.fromEntries(numericFields.map(field => [field.id, field.valueAsNumber]));
    result = calculateMortgage({
      ...numbers,
      province: byId('province').value,
      firstTime: byId('firstTime').checked,
      newBuild: byId('newBuild').checked,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    if (byId('downPayment').valueAsNumber > byId('price').valueAsNumber) {
      byId('downPayment').setAttribute('aria-invalid', 'true');
    }
    write('input-error', error.message);
    byId('input-error').hidden = false;
    byId('estimate').hidden = true;
    return;
  }

  byId('input-error').hidden = true;
  write('input-error', '');
  byId('estimate').hidden = false;
  write('minimum-down', money(result.minimumDown));
  write('qualifying-rate', percent(result.qualifyingRate));
  write('max-price', result.maxHomePrice === null ? 'No qualifying financed purchase' : money(result.maxHomePrice));
  write('mortgage-at-max', result.mortgageAtMaxPrice === null ? 'Unavailable' : money(result.mortgageAtMaxPrice));

  const downShort = result.downPaymentShortfall > 0;
  const cashPurchase = result.totalMortgage === 0;
  byId('outcome').dataset.outcome = cashPurchase ? 'cash' : result.passes ? 'pass' : 'fail';
  const outcome = downShort ? 'Down payment below the minimum' :
    cashPurchase ? 'Cash purchase · no mortgage stress test needed' :
    result.passes ? 'Passes both modeled debt service limits' : 'Fails the modeled debt service limits';
  write('status', outcome);
  const detail = byId('status-detail');
  detail.hidden = !downShort && cashPurchase;
  write('status-detail', downShort ? `Add ${money(result.downPaymentShortfall)} to the down payment to model this purchase.` :
    cashPurchase ? '' : `GDS ${percent(result.gds)} (${result.gdsPass ? 'pass' : 'fail'}) · TDS ${percent(result.tds)} (${result.tdsPass ? 'pass' : 'fail'})`);

  byId('eligible-results').hidden = downShort;
  if (downShort) return;

  write('actual-payment', money(result.actualPayment));
  write('stress-payment', money(result.stressPayment));
  write('base-loan', `${money(result.baseLoan)} · ${percent(result.ltv)} LTV`);
  write('premium', `${money(result.premium)} · ${percent(result.premiumRate)}`);
  write('total-mortgage', money(result.totalMortgage));
  write('premium-tax', `${money(result.premiumTax)} · ${percent(result.taxRate)}`);
  write('closing-cash', money(result.downPaymentAndTax));
  write('effective-amortization', cashPurchase ? 'Unavailable' : `${result.effectiveAmortization} years`);
  write('gds', cashPurchase ? 'Unavailable' : `${percent(result.gds)} · ${result.gdsPass ? 'PASS' : 'FAIL'}`);
  write('tds', cashPurchase ? 'Unavailable' : `${percent(result.tds)} · ${result.tdsPass ? 'PASS' : 'FAIL'}`);
  write('max-mortgage', money(result.maxQualifyingMortgage));

  const capped = byId('amortization').valueAsNumber > result.effectiveAmortization;
  byId('amortization-note').hidden = !capped;
  write('amortization-note', capped ? 'This insured scenario uses 25 years. A longer insured amortization requires an eligible first-time buyer or an eligible new build.' : '');
  byId('benchmark-note').hidden = cashPurchase;
  write('benchmark-note', cashPurchase ? '' :
    `Planning references · GDS is ${result.gds > 32 ? 'above' : 'at or below'} 32% and TDS is ${result.tds > 40 ? 'above' : 'at or below'} 40%.`);

  byId('remedies').hidden = result.passes || cashPurchase;
  write('income-remedy', `Increase gross household income by ${money(result.annualIncomeIncrease)} per year at the same expenses.`);
  write('debt-remedy', result.monthlyDebtReduction === null ?
    'Reducing other debts alone cannot bring housing costs within the GDS limit.' :
    `Reduce other monthly debt payments by ${money(result.monthlyDebtReduction)} at the same income.`);
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();

for (const ad of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(ad.dataset.adSlot)) (window.adsbygoogle = window.adsbygoogle || []).push({});
}
