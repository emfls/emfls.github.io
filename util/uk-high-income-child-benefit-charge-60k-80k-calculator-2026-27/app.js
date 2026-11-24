import { calculate } from './model.mjs';

const form = document.querySelector('#calculator');
const results = document.querySelector('#results');
const error = document.querySelector('#error');
const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 });
const taperPercent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });

function update() {
  const read = (name) => form.elements.namedItem(name).valueAsNumber;

  try {
    const { annualBenefit, highestAni, current, planned, taperRate, effectiveTaperRate, rescue } =
      calculate({ children: read('children'), ani: read('ani'), partnerAni: read('partnerAni'),
        plannedGross: read('plannedGross') });
    const values = {
      benefit: pounds.format(annualBenefit),
      highest: pounds.format(highestAni),
      charge: pounds.format(current.charge),
      clawback: percent.format(current.clawbackPct / 100),
      kept: pounds.format(current.kept),
      plannedHighest: pounds.format(planned.highestAni),
      plannedCharge: pounds.format(planned.charge),
      plannedSaved: pounds.format(planned.chargeSaved),
      effective: percent.format(effectiveTaperRate),
      taper: taperPercent.format(taperRate),
      ownTarget: pounds.format(rescue.ownGrossTarget),
      partnerTarget: pounds.format(rescue.partnerGrossTarget),
      grossTarget: pounds.format(rescue.grossTarget),
      upfront: pounds.format(rescue.upfrontCash),
      relief: pounds.format(rescue.incomeTaxRelief),
      saved: pounds.format(rescue.chargeSaved),
      netCost: rescue.netCost < 0
        ? pounds.format(-rescue.netCost) + ' net cash gain'
        : pounds.format(rescue.netCost),
      offset: rescue.offsetShare === null ? '—' : percent.format(rescue.offsetShare),
    };
    for (const output of results.querySelectorAll('[data-value]')) {
      output.textContent = values[output.dataset.value];
    }
    error.hidden = true;
    results.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    error.textContent = issue.message;
    error.hidden = false;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
