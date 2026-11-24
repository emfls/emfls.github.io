import { estimateWelcomeTax } from './model.mjs';

const get = id => document.getElementById(id);
const form = get('welcome-form');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const baseMoney = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 6,
});
const wholeMoney = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
});
const percent = new Intl.NumberFormat('en-CA', {
  style: 'percent', maximumFractionDigits: 2,
});

function optionalNumber(id) {
  const field = get(id);
  return field.value === '' && !field.validity.badInput ? undefined : field.valueAsNumber;
}

function renderSlices(slices) {
  const rows = slices.map(({ lower, upper, rate, taxable, duty }) => {
    const row = document.createElement('tr');
    const band = Number.isFinite(upper)
      ? `${wholeMoney.format(lower)}–${wholeMoney.format(upper)}`
      : `Over ${wholeMoney.format(lower)}`;
    for (const [index, text] of [band, percent.format(rate), baseMoney.format(taxable), money.format(duty)].entries()) {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = text;
      row.append(cell);
    }
    return row;
  });
  get('slices').replaceChildren(...rows);
  get('slice-table').hidden = slices.length === 0;
}

function update() {
  const exempt = get('family-exemption').checked;
  let quote;
  try {
    quote = estimateWelcomeTax({
      purchasePriceExTax: get('purchase').valueAsNumber,
      deedConsideration: optionalNumber('deed'),
      municipalAssessment: optionalNumber('assessment'),
      comparativeFactor: get('factor').valueAsNumber,
      localUpperRate: get('local-rate').valueAsNumber,
      jurisdiction: get('jurisdiction').value,
      familyExemption: exempt,
      torontoPeriod: get('toronto-period').value,
      singleFamily: get('property-type').value === 'one-two',
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    get('error').textContent = error.message;
    get('results').hidden = true;
    return;
  }

  const { selected } = quote;
  get('error').textContent = '';
  get('results').hidden = false;
  const premium = quote.premium > 0 ? `+${money.format(quote.premium)}` : money.format(quote.premium);
  get('result-summary').textContent = `${money.format(selected.duty)} estimated duty`;
  get('base').textContent = baseMoney.format(selected.taxBase);
  get('base-source').textContent = selected.baseSources.join(' + ') || 'All amounts are zero';
  get('adjusted').textContent = baseMoney.format(selected.adjustedAssessment);
  get('effective-rate').textContent = percent.format(selected.effectiveRate);
  get('premium').textContent = premium;
  get('montreal-duty').textContent = money.format(quote.montreal.duty);
  get('quebec-duty').textContent = money.format(quote.quebec.duty);
  get('ontario-duty').textContent = money.format(quote.ontarioDuty);
  get('toronto-duty').textContent = money.format(quote.torontoMunicipalDuty);
  get('toronto-total').textContent = money.format(quote.torontoCombinedDuty);
  get('credit').textContent = money.format(quote.homeownershipCredit);
  get('gross-duty').textContent = money.format(selected.grossDuty);
  get('exemption-note').hidden = !exempt;

  renderSlices(selected.slices);
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
