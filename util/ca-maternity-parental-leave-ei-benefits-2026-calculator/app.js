import { calculateBenefits } from './model.mjs';

const form = document.querySelector('#ei-form');
const error = document.querySelector('#input-error');
const result = document.querySelector('#comparison');
const status = document.querySelector('#result-status');
const lossSummary = document.querySelector('#loss-summary');
const inputs = [...form.querySelectorAll('input[type="number"]')];
const partnerFields = [form.elements.standardPartnerWeeks, form.elements.extendedPartnerWeeks];
const optionTemplate = document.querySelector('#option-template');
const phaseTemplate = document.querySelector('#phase-template');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const formatPair = (gross, net) => `${money.format(gross)} / ${money.format(net)}`;

const phaseTitles = {
  maternity: 'Parent 1 maternity',
  parental: 'Parent 1 parental',
  partner: 'Parent 2 parental',
};

function createOption(type, title) {
  const card = optionTemplate.content.firstElementChild.cloneNode(true);
  card.classList.add(type);
  for (const phase of card.querySelectorAll('[data-phase]')) {
    phase.append(phaseTemplate.content.cloneNode(true));
  }
  const fields = Object.fromEntries(
    [...card.querySelectorAll(':scope > [data-value], :scope > dl [data-value]')]
      .map(element => [element.dataset.value, element]),
  );
  fields.title.textContent = title;
  result.append(card);
  return { card, fields };
}

const options = {
  standard: createOption('standard', '12-month standard'),
  extended: createOption('extended', '18-month extended'),
};

function displayPhase(section, phase) {
  const fields = Object.fromEntries(
    [...section.querySelectorAll('[data-value]')].map(element => [element.dataset.value, element]),
  );
  const { weeks, ei, topUp } = phase;
  const weekLabel = weeks === 1 ? 'week' : 'weeks';
  fields.heading.textContent = `${phaseTitles[section.dataset.phase]} · ${weeks} paid ${weekLabel}`;
  fields.weekly.textContent = formatPair(ei.weeklyGross, ei.weeklyNet);
  fields.biweekly.textContent = formatPair(ei.biweeklyGross, ei.biweeklyNet);
  fields['topup-row'].hidden = topUp.weeks === 0;
  fields['topup-label'].textContent = `Top-up per week (${topUp.weeks} paid)`;
  fields['phase-topup'].textContent = formatPair(topUp.weeklyGross, topUp.weeklyNet);
  section.hidden = weeks === 0;
}

function displayOption(type, scenario) {
  const { card, fields } = options[type];
  const { household, fullPlanEiGross, lostEiGross, lostEiNet, parent1ElapsedWeeks } = scenario;
  fields.net.textContent = money.format(household.net);
  fields.gross.textContent = money.format(household.gross);
  fields.ei.textContent = formatPair(household.eiGross, household.eiNet);
  fields.topup.textContent = formatPair(household.topUpGross, household.topUpNet);
  fields.full.textContent = money.format(fullPlanEiGross);
  fields.loss.textContent = formatPair(lostEiGross, lostEiNet);
  fields.elapsed.textContent = String(parent1ElapsedWeeks);
  for (const section of card.querySelectorAll('[data-phase]')) {
    displayPhase(section, scenario[section.dataset.phase]);
  }
  const hasPaidWeeks = scenario.maternity.weeks + scenario.parental.weeks + scenario.partner.weeks > 0;
  card.querySelector('details').hidden = !hasPaidWeeks;
}

function showError(message) {
  error.textContent = message;
  error.hidden = !message;
  result.hidden = Boolean(message);
  lossSummary.hidden = Boolean(message);
  if (message) status.textContent = 'Update the highlighted inputs to recalculate.';
}

function update() {
  const partnerEnabled = form.elements.parent2Salary.valueAsNumber > 0;
  for (const field of partnerFields) field.disabled = !partnerEnabled;

  const invalid = [];
  const values = {};
  for (const input of inputs) {
    const valid = input.validity.valid;
    if (valid) {
      input.removeAttribute('aria-invalid');
    } else {
      invalid.push(input);
      input.setAttribute('aria-invalid', 'true');
    }
    values[input.name] = input.disabled || input.value === '' ? 0 : input.valueAsNumber;
  }

  if (invalid.length > 0) {
    const input = invalid[0];
    const label = input.labels[0].textContent;
    const numberType = input.step === '1' ? 'a whole number' : 'a number';
    showError(`${label} must be ${numberType} from ${Number(input.min).toLocaleString('en-CA')} to ${Number(input.max).toLocaleString('en-CA')}.`);
    return;
  }

  const { standard, extended } = calculateBenefits({
    ...values,
    maternity: form.elements.maternity.checked,
    waitingWeeks: Number(form.elements.waitingWeeks.value),
  });

  displayOption('standard', standard);
  displayOption('extended', extended);
  showError('');

  const difference = Math.round((standard.household.net - extended.household.net) * 100) / 100;
  if (difference === 0) {
    status.textContent = 'Both options give the same estimated household total after tax.';
  } else {
    const higher = difference > 0 ? 'Standard' : 'Extended';
    status.textContent = `${higher} pays ${money.format(Math.abs(difference))} more after estimated tax under this leave plan.`;
  }

  if (extended.lostEiWeeks > 0) {
    const weeks = extended.lostEiWeeks === 1 ? 'week' : 'weeks';
    lossSummary.textContent = `At month ${values.returnMonth}, Parent 1 would leave ${extended.lostEiWeeks} paid ${weeks} unclaimed on the extended plan, worth ${money.format(extended.lostEiGross)} gross or ${money.format(extended.lostEiNet)} after estimated tax.`;
  } else {
    lossSummary.textContent = 'The planned return leaves no assigned extended EI weeks unclaimed.';
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
