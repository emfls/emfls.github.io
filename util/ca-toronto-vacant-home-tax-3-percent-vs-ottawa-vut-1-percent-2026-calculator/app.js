import { rentalComparison, screenVacancy } from './model.mjs';

const byId = (id) => document.getElementById(id);
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const amount = (value) => value === null ? '—' : currency.format(value);
const vacancyForm = byId('vacancy-form');
const rentalForm = byId('rental-form');
let previousCards = '';
const cities = { toronto: 'Toronto', ottawa: 'Ottawa', hamilton: 'Hamilton' };
const basisDetails = {
  principal: {
    guidance: 'Use this status for the home you ordinarily live in and can document as your main residence.',
    months: 'I used this home as my principal residence for at least six months.',
    evidence: 'I can document principal residence status.',
  },
  tenant: {
    guidance: 'Count actual residential occupancy under qualifying lease terms. Toronto uses at least six months. Ottawa uses at least 184 days. Use terms of at least 30 consecutive days, with written leases for Toronto and Hamilton.',
    months: 'Tenants occupied the unit for at least six months in the same year.',
    evidence: 'I have qualifying written leases and can document tenant occupancy.',
  },
  renovation: {
    guidance: 'The work must make the unit uninhabitable. Toronto requires at least six months, Ottawa’s by-law uses more than 184 days, and Hamilton’s published by-law uses at least 183 days.',
    months: 'The work prevented occupancy for at least six months.',
    evidence: 'The required permits were issued and work proceeded without unreasonable delay.',
  },
  death: {
    guidance: 'Toronto covers the year of death and the next two years. Ottawa and Hamilton cover the year of death and the next year. Vacancy caused by the death must exceed 184 days in Ottawa or 183 days under Hamilton’s published by-law. Hamilton estate extensions need a separate review.',
    evidence: 'The registered owner’s death caused the vacancy and I have supporting documentation.',
  },
  care: {
    guidance: 'Toronto requires at least six months of care and allows up to two consecutive claims. Ottawa requires more than 184 days of vacancy due to care. Hamilton’s published by-law requires at least 183 days in an eligible facility.',
    months: 'The principal resident was in an eligible facility for at least six months.',
    evidence: 'Eligible hospital, long-term or supportive care caused the vacancy, and I have facility documentation.',
  },
};

function number(id) {
  const input = byId(id);
  if (!input.validity.valid) {
    const label = input.labels[0].textContent.trim();
    throw new RangeError(`Check “${label}” for a value between ${input.min} and ${input.max}.`);
  }
  return input.valueAsNumber;
}

function updateExemptionFields(basis) {
  const details = basisDetails[basis];
  byId('exemption-inputs').hidden = !details;
  if (!details) return;
  byId('basis-guidance').textContent = details.guidance;
  byId('six-month-label').textContent = details.months ?? '';
  byId('six-month-field').hidden = !details.months;
  byId('evidence-label').textContent = details.evidence;
  byId('reason-field').hidden = !['renovation', 'death', 'care'].includes(basis);
  byId('death-field').hidden = basis !== 'death';
  byId('care-field').hidden = basis !== 'care';
}

function showError(error, errorId, resultId) {
  if (!(error instanceof RangeError)) throw error;
  byId(errorId).textContent = error.message;
  byId(errorId).hidden = false;
  byId(resultId).hidden = true;
}

function cityCard(id, result) {
  const badge = result.status;
  let explanation = 'Vacancy threshold exceeded.';
  if (result.deemedVacant) explanation = 'Deemed vacant after a missed declaration.';
  else if (badge === 'REVIEW_REQUIRED') explanation = 'Check the six-month threshold against your dates.';
  else if (result.qualifies) explanation = 'Selected occupancy or exemption passes the screen.';
  else if (badge === 'EXEMPT_$0') explanation = 'Entered dates do not exceed the taxable vacancy threshold.';
  const fee = id === 'hamilton' && result.filingFee > 0
    ? `${amount(result.filingFee)} (published 2026 billing cycle)`
    : amount(result.filingFee);
  const interest = id === 'toronto'
    ? `<dt>Estimated overdue interest</dt><dd>${amount(result.overdueInterest)}</dd>`
    : '';

  return `<article class="city" aria-label="${cities[id]} vacancy tax">
    <h3>${cities[id]} · ${result.percent}%</h3>
    <strong class="annual">${amount(result.annualTax)}</strong>
    <span class="badge" data-status="${badge}">${badge}</span>
    <p class="note">${explanation}</p>
    <dl>
      <dt>Five-year vacancy tax</dt><dd>${amount(result.fiveYearTax)}</dd>
      <dt>Declaration fee estimate</dt><dd>${fee}</dd>
      ${interest}
    </dl>
  </article>`;
}

function renderVacancy() {
  const basis = byId('basis').value;
  const filing = byId('filing').value;
  updateExemptionFields(basis);
  try {
    const vacantDays = number('vacant-days');
    byId('toronto-boundary').hidden = vacantDays < 181 || vacantDays > 184;
    const torontoAnswer = byId('toronto-vacant').value;
    const reasonDays = byId('reason-field').hidden ? 0 : number('reason-days');
    if (reasonDays > vacantDays) {
      throw new RangeError('Vacant days caused by the selected reason must fit within total vacant days.');
    }
    const result = screenVacancy({
      assessment: number('assessment'),
      vacantDays,
      torontoVacant: torontoAnswer === 'review' ? null : torontoAnswer === 'yes',
      ottawaYear: Number(byId('ottawa-year').value),
      filing,
      basis,
      sixMonths: byId('six-months').checked,
      evidence: byId('evidence').checked,
      reasonDays,
      deathYear: basis === 'death' ? number('death-year') : undefined,
      careYear: basis === 'care' ? number('care-year') : undefined,
      overdueCharges: number('overdue-charges'),
    });
    const cards = Object.entries(result).map(([id, city]) => cityCard(id, city)).join('');
    if (previousCards !== cards) {
      byId('city-results').innerHTML = cards;
      previousCards = cards;
    }
    byId('city-results').hidden = false;
    byId('vacancy-error').hidden = true;
    const messages = {
      onTime: 'An annual declaration is still required for a principal residence or an exempt unit.',
      lateAccepted: 'Accepted late declarations can carry fees even where the vacancy tax is $0. Toronto’s late-declaration fee is suspended.',
      missed: 'The model shows the bill before any successful correction or appeal. Check the deadlines on your city’s notice.',
    };
    if (byId('filing-message').textContent !== messages[filing]) {
      byId('filing-message').textContent = messages[filing];
    }
  } catch (error) {
    byId('filing-message').textContent = '';
    showError(error, 'vacancy-error', 'city-results');
  }
}

function renderRental() {
  try {
    const result = rentalComparison({
      assessment: number('assessment'),
      monthlyRent: number('monthly-rent'),
      deductibleCosts: number('deductible-costs'),
      otherCosts: number('other-costs'),
      taxRate: number('tax-rate'),
    });
    byId('gross-rent').textContent = amount(result.grossRent);
    byId('income-tax').textContent = amount(result.incomeTax);
    byId('net-rental').textContent = amount(result.netRentalIncome);
    byId('tax-saved').textContent = amount(result.taxSaved);
    byId('net-gain').textContent = amount(result.gain);
    byId('break-even').textContent = result.breakEvenRent === null
      ? 'No finite rent in this model'
      : amount(result.breakEvenRent);
    byId('rental-results').hidden = false;
    byId('rental-error').hidden = true;
  } catch (error) {
    showError(error, 'rental-error', 'rental-results');
  }
}

for (const form of [vacancyForm, rentalForm]) {
  form.addEventListener('submit', (event) => event.preventDefault());
}
vacancyForm.addEventListener('input', ({ target }) => {
  if (target.id === 'basis') {
    byId('six-months').checked = false;
    byId('evidence').checked = false;
    byId('reason-days').value = String(Math.min(200, Math.max(0, byId('vacant-days').valueAsNumber || 0)));
  }
  renderVacancy();
  if (target.id === 'assessment') renderRental();
});
rentalForm.addEventListener('input', renderRental);
renderVacancy();
renderRental();
