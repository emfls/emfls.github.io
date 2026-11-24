import { calculateContribution, simulateDistribution } from './model.mjs';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2
});

const element = (id) => document.getElementById(id);
const dollars = (amount) => currency.format(amount);

function number(id) {
  const input = element(id);
  const label = input.labels[0].textContent;
  if (!Number.isFinite(input.valueAsNumber)) {
    throw new RangeError(`Enter a number for “${label}”.`);
  }
  if (input.validity.stepMismatch) {
    throw new RangeError(`Check the precision for “${label}”.`);
  }
  return input.valueAsNumber;
}

function writeFigures(values) {
  for (const [id, value] of Object.entries(values)) {
    element(id).textContent = value;
  }
}

function rates() {
  return { federalRate: number('federal-rate'), stateRate: number('state-rate') };
}

function showEstimate(formName, render) {
  const results = element(`${formName}-results`);
  const error = element(`${formName}-error`);
  try {
    render();
    error.hidden = true;
    results.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    error.textContent = issue.message;
    error.hidden = false;
  }
}

function renderContribution() {
  showEstimate('contribution', () => {
    const employerMethod = element('employer-method').value;
    const plannedDeferral = number('planned-deferral');
    const estimate = calculateContribution({
      compensation: number('compensation'),
      age: number('year-end-age'),
      employeeCount: number('employee-count'),
      section117Eligible: element('eligible-employer').checked,
      smallEmployerGrace: element('small-employer-grace').checked,
      enhancedElection: element('enhanced-election').checked,
      employerMethod,
      additionalRate: number('additional-rate'),
      plannedDeferral,
      ...rates()
    });
    const plan = estimate.enhanced ? 'SECURE 2.0 enhanced limit' : 'Standard limit';
    const employer = employerMethod === 'match' ? 'match' : 'nonelective contribution';
    const base401k = dollars(estimate.base401k);
    const benchmark = estimate.ageAdjusted401k === estimate.base401k
      ? `${base401k} base`
      : `${base401k} base · ${dollars(estimate.ageAdjusted401k)} with catch-up`;
    const clipped = plannedDeferral > estimate.employeeMaximum
      ? ` The entered deferral exceeds your estimated maximum and was capped at ${dollars(estimate.employeeMaximum)}.`
      : '';

    writeFigures({
      'plan-summary': `${plan} · ${dollars(estimate.baseLimit)} base + ${dollars(estimate.catchUp)} catch-up · ${estimate.employerRate}% employer ${employer}`,
      'combined-maximum': dollars(estimate.combinedMaximum),
      'tax-saved': dollars(estimate.taxSavings.total),
      'employee-maximum': dollars(estimate.employeeMaximum),
      'employee-contribution': dollars(estimate.employeeContribution),
      'employer-contribution': dollars(estimate.employerContribution),
      'additional-contribution': dollars(estimate.additionalContribution),
      'combined-contribution': dollars(estimate.combinedContribution),
      'remaining-deferral': dollars(estimate.remainingDeferral),
      'maximum-tax-saved': dollars(estimate.maximumTaxSavings.total),
      'benchmark-401k': benchmark,
      'contribution-detail': `Planned deferral savings include ${dollars(estimate.taxSavings.federal)} federal and ${dollars(estimate.taxSavings.state)} state. Your SIMPLE IRA base limit is ${dollars(estimate.baseLimitGap)} below the 401(k) base limit.${clipped}`
    });
  });
}

const distributionStatuses = {
  withdrawal: 'Cash withdrawal generally counts as ordinary income.',
  restricted: 'The receiving account is restricted during the first two years. This attempted move is treated as a taxable distribution.',
  rollover: 'A qualifying rollover or transfer has no current income tax or additional early-distribution tax.',
  conversion: 'A qualifying conversion adds the pre-tax amount to ordinary income and has no additional tax on the amount converted.'
};

function renderDistribution() {
  showEstimate('distribution', () => {
    const withinTwoYears = element('distribution-timing').value === 'within';
    const inputs = {
      amount: number('distribution-amount'),
      transaction: element('transaction').value,
      age: number('distribution-age'),
      qualifiesForException: element('distribution-exception').checked,
      ...rates()
    };
    const estimate = simulateDistribution({ ...inputs, withinTwoYears });
    const alternate = simulateDistribution({ ...inputs, withinTwoYears: !withinTwoYears });
    const otherTiming = withinTwoYears ? 'on or after 2 years' : 'before 2 years';

    writeFigures({
      'distribution-status': distributionStatuses[estimate.status],
      'distribution-penalty': `${dollars(estimate.penalty)} (${estimate.penaltyRate}%)`,
      'distribution-total': dollars(estimate.totalTax),
      'distribution-taxable': dollars(estimate.taxableAmount),
      'distribution-income-tax': dollars(estimate.incomeTax),
      'distribution-net': dollars(estimate.afterTax),
      'distribution-alternate': `${dollars(alternate.totalTax)} ${otherTiming} (${alternate.penaltyRate}% additional tax)`,
      'distribution-detail': `Ordinary income tax includes ${dollars(estimate.federalTax)} federal and ${dollars(estimate.stateTax)} state. The timing comparison holds age, amount and tax rates constant.`
    });
  });
}

const contributionForm = element('contribution-form');
const distributionForm = element('distribution-form');
for (const form of [contributionForm, distributionForm]) {
  form.addEventListener('submit', (event) => event.preventDefault());
}
contributionForm.addEventListener('input', (event) => {
  renderContribution();
  if (event.target.id === 'federal-rate' || event.target.id === 'state-rate') {
    renderDistribution();
  }
});
distributionForm.addEventListener('input', renderDistribution);

renderContribution();
renderDistribution();
