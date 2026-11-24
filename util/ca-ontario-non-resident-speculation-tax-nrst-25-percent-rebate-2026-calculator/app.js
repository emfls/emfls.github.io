import {
  canCertifyExemption, calculateClosingTaxes, evaluatePrRebate, calculateCarryingCost,
} from './model.mjs';

const element = (id) => document.getElementById(id);
const value = (id) => element(id).value;
const checked = (id) => element(id).checked;
const setText = (id, text) => { element(id).textContent = text; };
const setHidden = (id, hidden) => { element(id).hidden = hidden; };
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('en-CA', {
  dateStyle: 'medium', timeZone: 'UTC',
});

const taxErrors = {
  price: 'Enter a value of consideration from $0.01 to $1 billion with up to two decimal places.',
  registration: 'Enter a valid registration date in 2026.',
  location: 'Select a property location in Ontario.',
  residences: 'Select the number of single-family residences.',
  buyer: 'Select buyer status at closing.',
  title: 'Select the ownership arrangement at registration.',
};
const rebateReasons = {
  entity: 'The personal PR rebate does not apply to a foreign corporation or a taxable trustee on title.',
  'tax-not-due': 'This scenario has no Ontario NRST to rebate.',
  title: 'The foreign applicant must be the sole buyer on title or share title exclusively with their spouse from registration.',
  'title-interrupted': 'Confirm the foreign applicant holds title alone or exclusively with their spouse through the rebate claim.',
  'pr-missing': 'Enter a valid date permanent residence was granted.',
  'pr-before-registration': 'This date-only screen requires PR status after registration. Verify the order of events if both occurred on the same day.',
  'pr-late': 'The date fails the strict four-year screen. Use an effective PR date before the fourth anniversary.',
  'move-in-missing': 'Enter the date all required occupants began using the property as their principal residence.',
  'move-in-before-registration': 'Enter the start of the principal-residence period on or after registration. Use registration day if you already lived there.',
  'move-in-late': 'All required occupants must start using the property as their principal residence within 60 days of registration.',
  'occupancy-interrupted': 'Confirm continuous principal residence through filing or until all rebate conditions are met, whichever is later.',
  'application-missing': 'Enter the date Ontario receives the rebate application.',
  'filing-before-pr': 'The application date must be on or after the date PR status was granted.',
  'filing-before-occupancy': 'The application date must be on or after the principal-residence move-in date.',
  'filing-late': 'Ontario must receive the claim within 180 days of PR status and no later than four years plus 180 days after the tax became payable.',
};

function displayDate(isoDate) {
  return date.format(new Date(isoDate + 'T00:00:00Z'));
}

function render() {
  const buyer = value('buyer');
  const title = value('title');
  const residences = Number(value('residences'));
  const isIndividual = ['foreign', 'nominee', 'protected'].includes(buyer);
  const canCertify = canCertifyExemption(buyer, title, residences);

  setHidden('title-field', !isIndividual);
  setHidden('certification-field', !canCertify);
  const taxes = calculateClosingTaxes({
    price: element('price').valueAsNumber,
    registration: value('registration'),
    location: value('location'),
    residences,
    buyer,
    title,
    certifiedOccupancy: canCertify && checked('certified-occupancy'),
  });

  setHidden('results', Boolean(taxes.error));
  setHidden('tax-error', !taxes.error);
  setText('tax-error', taxErrors[taxes.error] ?? '');
  if (taxes.error) return;

  const showClaim = isIndividual && taxes.nrst > 0;
  setHidden('claim-fields', !showClaim);
  const rebate = evaluatePrRebate(taxes, {
    prDate: value('pr-date'),
    moveInDate: value('move-in'),
    applicationDate: value('application'),
    continuousOccupancy: checked('continuous-occupancy'),
    continuousTitle: checked('continuous-title'),
  });
  const disqualified = rebate.status === 'DISQUALIFIED';
  setHidden('financing-fields', disqualified);

  for (const [id, amount] of Object.entries({
    'total-tax': taxes.total,
    nrst: taxes.nrst,
    'ontario-ltt': taxes.ontarioLtt,
    'toronto-mltt': taxes.torontoMltt,
    'stacked-ltt': taxes.landTransferTax,
    'toronto-mnrst': taxes.torontoMnrst,
    'rebate-amount': rebate.amount,
  })) setText(id, money.format(amount));
  setText('effective-rate', percent.format(taxes.effectiveRate) + '% of consideration');
  setText('rebate-status', rebate.status);
  element('rebate-status').toggleAttribute('data-disqualified', disqualified);

  const reasons = rebate.reasons.map((key) => {
    const item = document.createElement('li');
    item.textContent = rebateReasons[key];
    return item;
  });
  element('rebate-reasons').replaceChildren(...reasons);
  setHidden('rebate-reasons', !reasons.length);

  setHidden('deadlines', !showClaim);
  if (showClaim) {
    const dates = [
      'Fourth anniversary ' + displayDate(rebate.fourYearAnniversary),
      'Move in by ' + displayDate(rebate.moveInDeadline),
    ];
    if (rebate.filingDeadline) dates.push('File by ' + displayDate(rebate.filingDeadline));
    setText('deadlines', dates.join(' · '));
  }

  const carry = calculateCarryingCost(
    taxes.nrst, element('rate').valueAsNumber, element('delay').valueAsNumber, rebate,
  );
  setText('carrying-cost', carry ? money.format(carry.interest) : '—');
  setHidden('carry-detail', disqualified);
  if (carry) {
    setText('carry-detail',
      carry.days + ' days of simple interest on the full Ontario NRST until ' +
      displayDate(carry.receiptDate) + '. Assumes an interest-only loan with a fixed rate and a full rebate. Excludes fees and any interest Ontario pays on the rebate.');
  } else if (!disqualified) {
    setText('carry-detail', 'Enter a borrowing rate from 0% to 100% and a whole-number delay from 0 to 3,650 days.');
  }
}

const form = element('nrst-form');
form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
