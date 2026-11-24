import { calculate, RULES } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('depreciation-form');
const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const money = value => value === null ? 'N/A' : moneyFormat.format(Math.round(value) || 0);
const percent = value => decimalFormat.format(value) + '%';

function setFieldVisible(id, visible) {
  const wrapper = byId(id);
  wrapper.hidden = !visible;
  for (const control of wrapper.querySelectorAll('input, select')) {
    control.disabled = !visible;
  }
}

function setValue(id, value) {
  byId(id).textContent = value;
}

function render(result) {
  const { standard, accelerated, grossSavings, netSavings, roiPct, basis, years,
    allowance, businessCapacity, nonpassive, strException, allocations, reclassPct } = result;

  setValue('gross-savings', money(grossSavings));
  setValue('net-savings', money(netSavings));
  byId('net-savings').classList.toggle('negative', netSavings < 0);
  setValue('roi', roiPct === null ? 'N/A' : percent(roiPct));
  byId('roi').classList.toggle('negative', roiPct < 0);
  setValue('basis-summary', `Depreciable basis ${money(basis)} · ${years}-year building · ${percent(result.yearFraction * 100)} of a full year.`);
  let gate = `Passive rental · up to ${money(allowance)} of the modeled special allowance available against ordinary income.`;
  if (nonpassive) {
    gate = `Nonpassive activity · ${money(businessCapacity)} of modeled §461(l) capacity after other business income or losses.`;
  } else if (strException) {
    gate = 'Passive short-stay activity · material participation is required for nonpassive treatment. The rental real estate special allowance is unavailable under this exception.';
  }
  setValue('gate-summary', gate);

  for (const [metric, value] of Object.entries(standard)) {
    setValue(`standard-${metric}`, money(value));
    setValue(`accelerated-${metric}`, money(accelerated?.[metric] ?? null));
  }

  setValue('allocation-summary', accelerated
    ? `Reclassified ${percent(reclassPct)} of basis · 5-year ${money(allocations.five)} · 7-year ${money(allocations.seven)} · 15-year ${money(allocations.fifteen)} · structure ${money(allocations.structural)}.`
    : 'The cost segregation comparison requires 100% bonus eligibility. The standard MACRS estimate is available.');

  let warning = 'The first-year tax benefit can be smaller than the upfront fee when losses carry forward.';
  if (netSavings < 0) {
    warning = `The estimated first-year tax benefit falls short of the study fee by ${money(-netSavings)}.`;
  }
  if (accelerated?.suspended > 0) {
    warning += ` The cost segregation scenario suspends ${money(accelerated.suspended)} of passive loss.`;
  }
  if (accelerated?.eblDeferred > 0) {
    warning += ` The cost segregation scenario defers ${money(accelerated.eblDeferred)} as excess business loss.`;
  }
  setValue('cash-warning', warning);
}

function update() {
  const activity = byId('activity').value;
  const eligible = byId('eligible').checked;
  setFieldVisible('allocation-fields', eligible);
  setFieldVisible('average-stay-field', activity === 'str');
  setFieldVisible('reps-hours-field', activity === 'reps');
  setFieldVisible('reps-time-field', activity === 'reps');
  setFieldVisible('material-field', activity !== 'rental');

  const strException = activity === 'str' && byId('averageStay').valueAsNumber <= RULES.strDays;
  const qualifiedReps = activity === 'reps' && byId('repsHours').valueAsNumber > RULES.repsHours
    && byId('repsTime').valueAsNumber > RULES.repsTimePct;
  const nonpassive = (strException || qualifiedReps) && byId('material').checked;
  setFieldVisible('business-field', nonpassive);
  setFieldVisible('active-field', !nonpassive && !strException);
  setFieldVisible('magi-field', !byId('active').disabled && byId('active').checked);
  setFieldVisible('passive-income-field', !nonpassive);

  const number = id => {
    const input = byId(id);
    return input.disabled ? 0 : input.valueAsNumber;
  };

  const error = byId('input-error');
  try {
    const result = calculate({
      purchasePrice: number('purchasePrice'), closingCosts: number('closingCosts'), landPct: number('landPct'),
      month: Number(byId('month').value), building: byId('building').value, eligible,
      fivePct: number('fivePct'), sevenPct: number('sevenPct'), fifteenPct: number('fifteenPct'),
      rentalNet: number('rentalNet'), passiveIncome: number('passiveIncome'), magi: number('magi'),
      rate: number('rate'), fee: number('fee'), filing: byId('filing').value, activity,
      active: byId('active').checked, material: byId('material').checked,
      averageStay: number('averageStay'), repsHours: number('repsHours'), repsTime: number('repsTime'),
      otherBusinessNet: number('otherBusinessNet'),
    });
    render(result);
    byId('results').hidden = false;
    error.hidden = true;
    error.textContent = '';
    setValue('live-summary', result.accelerated
      ? `Updated estimate. Net first-year savings ${money(result.netSavings)}.`
      : `Updated estimate. Standard depreciation ${money(result.standard.depreciation)}.`);
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    byId('results').hidden = true;
    error.hidden = false;
    error.textContent = problem.message;
    setValue('live-summary', 'Correct the input described above to see updated results.');
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
byId('results-placeholder').hidden = true;
update();
