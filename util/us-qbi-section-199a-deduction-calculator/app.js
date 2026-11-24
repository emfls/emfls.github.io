import { calculateQbi, MINIMUM_DEDUCTION } from './model.mjs';

const form = document.getElementById('qbi-form');
const byId = id => document.getElementById(id);
const inputs = Object.fromEntries(Array.from(form.elements, field => [field.id, field]));
const outputs = Object.fromEntries([
  'deduction', 'tax-savings', 'phase', 'eligible', 'business-component',
  'reit-component', 'overall-cap', 'range', 'floor', 'wage-insight',
].map(id => [id, byId(id)]));

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });

function describeFloor(result) {
  if (!result.floorEligible) {
    return 'The $400 active-business minimum does not apply to these inputs.';
  }
  if (result.floorApplied) {
    return result.effectiveFloor < MINIMUM_DEDUCTION
      ? `The active-business minimum increased the deduction to ${dollars.format(result.effectiveFloor)}, the modeled taxable-income cap.`
      : 'The $400 active-business minimum increased the deduction to $400.00.';
  }
  if (result.effectiveFloor < MINIMUM_DEDUCTION) {
    return 'The modeled taxable-income cap leaves no room for the active-business minimum to increase the deduction.';
  }
  return 'The regular deduction already meets the $400 active-business minimum.';
}

function describeWages(result) {
  if (result.applicablePercentage === 0) {
    return 'The SSTB has fully phased out. Additional wages cannot restore the business component.';
  }
  if (!result.wageLimited) {
    return 'The wage and property limit does not reduce the business component for these inputs.';
  }
  const amount = dollars.format(result.additionalW2Wages);
  const target = result.deductionWithWageLimitRemoved;
  const effect = target > result.finalDeduction
    ? `The resulting deduction would be ${dollars.format(target)}.`
    : 'The final deduction would stay the same under these inputs.';
  return `${amount} in additional eligible W-2 wages would remove the modeled wage limit if other inputs held steady. ${effect}`;
}

function render() {
  const result = calculateQbi({
    filingStatus: inputs['filing-status'].value,
    businessType: inputs['business-type'].value,
    taxableIncomeBeforeQbi: inputs['taxable-income'].valueAsNumber,
    qbi: inputs.qbi.valueAsNumber,
    w2Wages: inputs['w2-wages'].valueAsNumber,
    ubiaProperty: inputs.ubia.valueAsNumber,
    reitPtpIncome: inputs['reit-ptp'].valueAsNumber,
    netCapitalGains: inputs['capital-gains'].valueAsNumber,
    marginalRate: inputs['marginal-rate'].valueAsNumber / 100,
    isActiveMaterialParticipant: inputs.active.checked,
  });

  const filing = inputs['filing-status'].selectedOptions[0].text;
  const display = {
    deduction: dollars.format(result.finalDeduction),
    'tax-savings': dollars.format(result.estimatedTaxSavings),
    phase: percent.format(result.phaseInRatio),
    eligible: percent.format(result.applicablePercentage),
    'business-component': dollars.format(result.businessComponent),
    'reit-component': dollars.format(result.reitComponent),
    'overall-cap': dollars.format(result.overallCap),
    range: `Modeled ${filing} phase-in range: ${wholeDollars.format(result.threshold)}–${wholeDollars.format(result.phaseInUpper)}.`,
    floor: describeFloor(result),
    'wage-insight': describeWages(result),
  };

  for (const [id, value] of Object.entries(display)) {
    if (outputs[id].textContent !== value) outputs[id].textContent = value;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
form.addEventListener('change', render);
render();

// Each in-content placement is initialized once a publisher-owned slot is configured.
for (const ad of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (ad.dataset.adSlot) (window.adsbygoogle ||= []).push({});
}
