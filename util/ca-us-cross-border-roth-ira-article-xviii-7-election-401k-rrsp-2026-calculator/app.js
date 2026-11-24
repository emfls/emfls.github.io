import { calculateRoth, calculateRetirement, electionDeadline } from './model.mjs';

const byId = id => document.getElementById(id);
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'code', maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });
const deadlineDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const deadlineComparison = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Toronto' });

function todayInCanada() {
  const parts = Object.fromEntries(deadlineComparison.formatToParts().map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const rothForm = byId('roth-form');
const retirementForm = byId('retirement-form');
const rothOutputs = byId('roth-result').querySelectorAll('[data-roth]');
const retirementOutputs = byId('retirement-result').querySelectorAll('[data-plan]');

function numericValue(field) {
  if (!field.validity.valid) {
    throw new RangeError(`${field.labels[0].textContent}: ${field.validationMessage}`);
  }
  return field.valueAsNumber;
}

function showProjection(formId, render) {
  const error = byId(`${formId}-error`);
  const result = byId(`${formId}-result`);
  try {
    render();
    error.textContent = '';
    result.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    result.hidden = true;
    error.textContent = problem.message;
  }
}

function renderRoth() {
  const fields = rothForm.elements;
  const hasContribution = fields.hasContribution.checked;
  for (const field of rothForm.querySelectorAll('[data-contribution]')) field.hidden = !hasContribution;
  fields.contributionYear.max = fields.years.validity.valid ? fields.years.value : '30';
  byId('contribution-warning').hidden = !hasContribution;

  const election = fields.election.value;
  const selfEmployed = fields.deadline.value === 'self';
  const deadline = electionDeadline(selfEmployed);
  const formattedDate = deadlineDate.format(new Date(`${deadline}T00:00:00Z`));
  const schedule = selfEmployed ? 'Eligible self-employed' : 'Standard';
  const pastDue = todayInCanada() > deadline;
  const alert = election === 'missed' || (election === 'pending' && pastDue)
    ? ' Contact CRA about a late election.'
    : '';
  byId('deadline-output').textContent = `${schedule} 2026 arrival filing deadline: ${formattedDate}.${alert}`;

  showProjection('roth', () => {
    const result = calculateRoth({
      balance: numericValue(fields.balance),
      growth: numericValue(fields.growth) / 100,
      yieldRate: numericValue(fields.yieldRate) / 100,
      years: numericValue(fields.years),
      marginalRate: numericValue(fields.marginalRate) / 100,
      realizedShare: numericValue(fields.realizedShare) / 100,
      contribution: hasContribution ? numericValue(fields.contribution) : 0,
      contributionYear: hasContribution ? numericValue(fields.contributionYear) : 1,
      election,
    });

    for (const output of rothOutputs) {
      const key = output.dataset.roth;
      const value = result[key];
      output.textContent = value === null ? '' : (key === 'annualTaxDrag' ? percent : cad).format(value);
    }
    byId('roth-pending').hidden = election !== 'pending';
    byId('roth-pending').textContent = pastDue
      ? 'The selected deadline has passed. Ask CRA whether it will accept a late election.'
      : 'Election pending. Both projections above use your original balance.';
    byId('roth-selected').hidden = election === 'pending';
    byId('roth-contribution-result').hidden = !hasContribution || election === 'missed';
  });
}

function renderRetirement() {
  const fields = retirementForm.elements;
  const payout = fields.payout.value;
  const isLump = payout === 'lump';
  byId('eligible-field').hidden = !isLump;

  showProjection('retirement', () => {
    const result = calculateRetirement({
      balance: numericValue(fields.balance),
      age: numericValue(fields.age),
      years: numericValue(fields.years),
      annualReturn: numericValue(fields.annualReturn) / 100,
      canadaRate: numericValue(fields.canadaRate) / 100,
      retirementRate: numericValue(fields.retirementRate) / 100,
      payout,
      room: numericValue(fields.room),
      transferEligible: isLump ? numericValue(fields.transferEligible) : 0,
      outsideCash: numericValue(fields.outsideCash),
      earlyException: fields.earlyException.checked,
      creditEarlyTax: fields.creditEarlyTax.checked,
    });

    for (const output of retirementOutputs) {
      const key = output.dataset.plan;
      const value = result[key];
      output.textContent = cad.format(key === 'holdAdvantage' || key === 'outsideNet' ? Math.abs(value) : value);
    }

    byId('advantage-label').textContent = result.holdAdvantage >= 0
      ? 'After-tax advantage of keeping the US plan'
      : 'After-tax advantage of cashing out';
    byId('outside-label').textContent = result.outsideNet >= 0
      ? 'Cash kept outside RRSP after tax'
      : 'Outside cash used for deposit and remaining taxes';
    const holdEarlyTax = result.holdEarlyTax > 0
      ? ` The projected payout age also triggers ${cad.format(result.holdEarlyTax)} in additional US tax in this model.`
      : '';
    byId('hold-tax-detail').textContent =
      `Keeping the US plan assumes ${cad.format(result.holdUSTax)} in regular US tax at retirement and ${cad.format(result.holdCredit)} in Canadian foreign tax credit.${holdEarlyTax}`;
  });
}

for (const [form, render] of [[rothForm, renderRoth], [retirementForm, renderRetirement]]) {
  form.addEventListener('input', render);
  form.addEventListener('submit', event => {
    event.preventDefault();
    render();
  });
  render();
}

const printButton = byId('print-checklist');
printButton.addEventListener('click', () => window.print());
printButton.hidden = false;
