import { calculateSale, simulateRecovery } from './model.mjs';

const form = document.querySelector('#sale-form');
const results = document.querySelector('#results');
const error = document.querySelector('#error');
const format = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const money = amount => format.format(amount);
const input = name => form.elements.namedItem(name);
const amount = name => input(name).valueAsNumber;
const show = (id, value) => {
  document.getElementById(id).textContent = value;
};

function update() {
  const province = input('province').value;
  const isQuebec = province === 'qc';
  for (const group of form.querySelectorAll('[data-quebec]')) {
    group.hidden = !isQuebec;
    group.disabled = !isQuebec;
  }

  try {
    if (!form.checkValidity()) {
      const invalid = form.querySelector(':invalid:is(input, select)');
      throw new RangeError(`${invalid.labels[0].textContent} — ${invalid.validationMessage}`);
    }

    const sale = calculateSale({
      gain: amount('gain'),
      priorLCGE: amount('prior-lcge'),
      otherIncome: amount('other-income'),
      combinedRate: amount('combined-rate'),
      regularFederalTax: amount('federal-tax'),
      regularQuebecTax: amount('quebec-tax'),
      province,
      holders: amount('holders'),
    });
    const recovery = simulateRecovery(sale, {
      regularFederal: amount('future-federal'),
      minimumFederal: amount('future-federal-minimum'),
      regularQuebec: amount('future-quebec'),
      minimumQuebec: amount('future-quebec-minimum'),
    });

    for (const [id, value] of Object.entries({
      'extra-amt': sale.totalExtraAMT,
      'regular-gain-tax': sale.totalRegularGainTax,
      'remaining-lcge': sale.groupRemainingLCGE,
      'exempt-gain': sale.exemptGain,
      'excess-gain': sale.excessGain,
      'gain-share': sale.gainPerPerson,
      'amt-income': sale.amtATI,
      'federal-minimum': sale.federalMinimumTax,
      'federal-extra': sale.federalExtra * sale.holders,
      'provincial-extra': sale.provincialExtra * sale.holders,
      'recovered': recovery.recovered,
      'expired': recovery.expired,
      'annual-federal-needed': recovery.federalTaxNeededPerYear,
    })) show(id, money(value));
    document.getElementById('quebec-result').hidden = !isQuebec;
    document.getElementById('quebec-recovery').hidden = !isQuebec;
    if (isQuebec) {
      show('quebec-minimum', money(sale.quebecMinimumTax));
      show('annual-quebec-needed', money(recovery.quebecTaxNeededPerYear));
    }

    const rows = recovery.years.map(({ year, federal, provincial, remaining }) => {
      const row = document.createElement('tr');
      const heading = document.createElement('th');
      heading.scope = 'row';
      heading.textContent = year;
      row.append(heading);
      for (const value of [federal, provincial, remaining]) row.insertCell().textContent = money(value);
      return row;
    });
    document.querySelector('#recovery-rows').replaceChildren(...rows);
    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
  } catch (cause) {
    if (!(cause instanceof RangeError)) throw cause;
    results.hidden = true;
    error.hidden = false;
    error.textContent = cause.message;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
form.addEventListener('change', update);
update();
