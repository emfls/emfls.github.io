import { compareStrategies } from './model.mjs';

const form = document.querySelector('#trust-calculator');
const third = document.querySelector('#third-adult');
const extra = document.querySelector('#extra-adult');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const money = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol',
});
const percent = new Intl.NumberFormat('en-AU', {
  style: 'percent', maximumFractionDigits: 2,
});
const adultLabels = ['Primary earner', 'Spouse', 'Third adult'];
const input = id => document.getElementById(id).valueAsNumber;
const show = (id, value) => { document.getElementById(id).textContent = value; };
const dollars = value => 'A' + money.format(value);

function render() {
  extra.disabled = !third.checked;
  extra.hidden = !third.checked;

  try {
    const adultIncomes = [input('primary-income'), input('spouse-income')];
    if (third.checked) adultIncomes.push(input('third-income'));
    const { noBucket, bucket, section100A, taxDeferred, effectiveRate } = compareStrategies({
      trustIncome: input('trust-income'),
      adultIncomes,
      companyRate: Number(document.querySelector('#company-rate').value),
    });

    show('no-bucket-tax', dollars(noBucket.tax));
    show('top-earner-tax', dollars(noBucket.topEarnerOnlyTax));
    show('bucket-tax', dollars(bucket.tax));
    show('tax-deferred', dollars(taxDeferred));
    show('effective-rate', effectiveRate === null ? 'N/A' : percent.format(effectiveRate));
    show('company-tax', dollars(bucket.companyTax));
    show('retained-profit', dollars(bucket.retainedProfit));
    show('franking', dollars(bucket.frankingCredits));
    show('trustee-tax', dollars(section100A.trusteeTax));
    show('extra-tax', dollars(section100A.extraTaxVsBucket));

    const allocations = document.querySelector('#allocations');
    const rows = [...adultLabels.slice(0, adultIncomes.length), 'Bucket company'].map((label, index) => {
      const row = document.createElement('tr');
      const name = document.createElement('th');
      name.scope = 'row';
      name.textContent = label;
      const personal = document.createElement('td');
      personal.textContent = dollars(noBucket.allocations[index] ?? 0);
      const withCompany = document.createElement('td');
      withCompany.textContent = dollars(bucket.allocations[index] ?? bucket.companyAllocation);
      row.append(name, personal, withCompany);
      return row;
    });
    allocations.replaceChildren(...rows);
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
