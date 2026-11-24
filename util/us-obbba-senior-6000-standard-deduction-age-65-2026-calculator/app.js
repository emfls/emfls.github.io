import { calculate } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('senior-form');
const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });

function person(prefix = '') {
  return {
    ageEligible: byId(prefix + 'age').checked,
    blind: byId(prefix + 'blind').checked,
    validSsn: byId(prefix + 'ssn').checked,
  };
}

function update() {
  const status = byId('status').value;
  const joint = status === 'mfj';
  const separate = status === 'mfs';
  const spouseItemizes = separate && byId('spouse-itemizes').checked;
  const mfsSpouseConditionsAllowed = separate && byId('mfs-spouse-allowed').checked;
  const method = byId('method').value;
  byId('method').disabled = spouseItemizes;
  const usesItemized = spouseItemizes || method === 'itemized';
  byId('itemized-field').hidden = !usesItemized;
  byId('itemized').disabled = !usesItemized;
  byId('mfs-field').hidden = !separate;
  byId('mfs-spouse-field').hidden = spouseItemizes;
  byId('spouse-field').hidden = !(joint || (mfsSpouseConditionsAllowed && !spouseItemizes));
  byId('ssn-field').hidden = separate;
  byId('spouse-ssn-field').hidden = !joint;

  const results = byId('results');
  const error = byId('input-error');
  let value;
  try {
    value = calculate({
      status, method, spouseItemizes, mfsSpouseConditionsAllowed,
      agi: byId('agi').valueAsNumber, magiAddbacks: byId('addbacks').valueAsNumber,
      itemized: byId('itemized').valueAsNumber, taxpayer: person(), spouse: person('spouse-'),
    });
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  const amounts = {
    total: value.totalDeduction, lost: value.phaseOutLoss, saved: value.taxSaved,
    base: value.baseStandard, traditional: value.traditionalAdditional,
    'before-bonus': value.deductionBeforeBonus, bonus: value.bonus, taxable: value.taxableWithBonus,
    'tax-before': value.taxWithoutBonus, 'tax-after': value.taxWithBonus,
  };
  for (const [id, amount] of Object.entries(amounts)) byId(id).textContent = dollars.format(amount);
  if (!value.standardAvailable) {
    byId('base').textContent = 'Unavailable';
    byId('traditional').textContent = 'Unavailable';
  }
  byId('method-used').textContent = value.useItemized ? 'Itemized deductions used' : 'Standard deduction used';
  byId('effective-rate').textContent = percent.format(value.effectiveMarginalRate);

  const people = value.qualifyingSeniors === 1 ? 'eligible senior' : 'eligible seniors';
  byId('filing-summary').textContent = `Schedule 1-A MAGI ${dollars.format(value.magi)} · ${value.qualifyingSeniors} ${people}`;
  const meter = byId('phase-meter');
  meter.hidden = value.maximumBonus === 0;
  if (value.maximumBonus === 0) {
    byId('phase-detail').textContent = separate
      ? 'Married filing separately is ineligible for the enhanced senior deduction.'
      : 'No senior meets both the age and valid SSN tests in this estimate.';
  } else {
    const phase = {
      full: 'Your income qualifies for the full deduction.',
      reducing: 'Your income is reducing the deduction.',
      'phased-out': 'Your income has fully phased out the deduction.',
    };
    meter.value = value.phaseOutLoss / value.maximumBonus;
    byId('phase-detail').textContent = `${phase[value.phase]} The phase-out band is ${dollars.format(value.phaseOutStart)}–${dollars.format(value.phaseOutEnd)} of MAGI, with a ${percent.format(value.phaseOutSlope)} deduction loss rate inside the band.`;
  }
  const ordinary = percent.format(value.ordinaryMarginalRate);
  byId('rate-detail').textContent = value.nextDollarPhaseOutRate > 0
    ? `At this income, the next ordinary dollar also reduces the deduction. Your ${ordinary} ordinary marginal rate × ${1 + value.nextDollarPhaseOutRate} = ${percent.format(value.effectiveMarginalRate)}.`
    : `At this income, the next ordinary dollar has a ${ordinary} marginal rate and no immediate senior deduction loss.`;
  error.hidden = true;
  results.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
