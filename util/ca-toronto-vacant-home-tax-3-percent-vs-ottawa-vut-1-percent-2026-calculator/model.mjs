const OCCUPANCY_YEAR = 2026;
const MAX_MONEY = 100_000_000;
const CITIES = [
  { id: 'toronto', rate: 3, filingFee: 0 },
  { id: 'ottawa', rate: 1, filingFee: 250 },
  { id: 'hamilton', rate: 1, filingFee: 250 },
];

function validate(value, min, max, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isInteger(value))) {
    throw new RangeError('A value is outside the calculator’s supported range.');
  }
}

function money(cents) {
  return cents / 100;
}

function cents(dollars) {
  return Math.round((dollars + Number.EPSILON) * 100);
}

function ottawaPercent(year) {
  return Math.min(year, 5);
}

export function ottawaRate(year) {
  validate(year, 1, Number.MAX_SAFE_INTEGER, true);
  return ottawaPercent(year) / 100;
}

function exemption(id, input) {
  const { basis, sixMonths, reasonDays, vacantDays, deathYear, careYear } = input;
  const toronto = id === 'toronto';
  const ottawa = id === 'ottawa';
  const hamilton = id === 'hamilton';
  const qualifyingReasonDays = ottawa ? reasonDays > 184 : reasonDays >= 183;

  if (!input.evidence) return false;

  switch (basis) {
    case 'principal':
      return hamilton || sixMonths;
    case 'tenant':
      if (toronto) return sixMonths;
      return 365 - vacantDays >= (ottawa ? 184 : 183);
    case 'renovation':
      return toronto ? sixMonths : qualifyingReasonDays;
    case 'death': {
      const age = OCCUPANCY_YEAR - deathYear;
      if (toronto) return age <= 2;
      return age <= 1 && reasonDays > (ottawa ? 184 : 183);
    }
    case 'care':
      if (toronto) return sixMonths && careYear <= 2;
      return qualifyingReasonDays;
    default:
      return false;
  }
}

// Toronto uses a calendar-month test. Around the boundary, require that fact
// explicitly instead of converting six months to a fixed number of days.
function torontoVacancy({ vacantDays, torontoVacant }) {
  if (vacantDays < 181) return false;
  if (vacantDays > 184) return true;
  return torontoVacant;
}

export function screenVacancy(input) {
  const { assessment, vacantDays, torontoVacant, ottawaYear, basis, filing, overdueCharges } = input;
  validate(assessment, 0, MAX_MONEY);
  validate(vacantDays, 0, 365, true);
  validate(overdueCharges, 0, 60, true);
  validate(ottawaYear, 1, Number.MAX_SAFE_INTEGER, true);
  if (![true, false, null].includes(torontoVacant) ||
      !['none', 'principal', 'tenant', 'renovation', 'death', 'care'].includes(basis) ||
      !['onTime', 'lateAccepted', 'missed'].includes(filing)) {
    throw new RangeError('Select a valid occupancy and declaration status.');
  }
  if (['renovation', 'care', 'death'].includes(basis)) {
    validate(input.reasonDays, 0, vacantDays, true);
  }
  if (basis === 'death') validate(input.deathYear, 1900, OCCUPANCY_YEAR, true);
  if (basis === 'care') validate(input.careYear, 1, 100, true);

  const assessedCents = cents(assessment);
  return Object.fromEntries(CITIES.map(({ id, rate, filingFee }) => {
    const ottawa = id === 'ottawa';
    const toronto = id === 'toronto';
    const percent = ottawa ? ottawaPercent(ottawaYear) : rate;
    const vacant = toronto ? torontoVacancy(input) : vacantDays > (ottawa ? 184 : 183);
    const deemedVacant = filing === 'missed';
    const qualifies = exemption(id, input);
    const taxable = deemedVacant || (!qualifies && vacant);
    const taxAtRate = (value) => Math.round(assessedCents * value / 100);
    const annual = taxable === null ? null : taxable ? taxAtRate(percent) : 0;
    const fiveYearTax = taxable === null ? null : money(
      taxable ? [0, 1, 2, 3, 4].reduce((sum, offset) =>
        sum + taxAtRate(ottawa ? ottawaPercent(ottawaYear + offset) : percent), 0) : 0,
    );
    return [id, {
      percent,
      status: taxable === null ? 'REVIEW_REQUIRED' : taxable ? 'TAXABLE_VACANT' : 'EXEMPT_$0',
      deemedVacant,
      qualifies,
      annualTax: annual === null ? null : money(annual),
      fiveYearTax,
      filingFee: filing === 'onTime' ? 0 : filingFee,
      overdueInterest: toronto && annual !== null
        ? money(overdueCharges * Math.round(annual / 80))
        : null,
    }];
  }));
}

export function rentalComparison({ assessment, monthlyRent, deductibleCosts, otherCosts, taxRate }) {
  for (const value of [assessment, monthlyRent, deductibleCosts, otherCosts]) {
    validate(value, 0, MAX_MONEY);
  }
  validate(taxRate, 0, 100);
  const deductible = cents(deductibleCosts);
  const other = cents(otherCosts);
  const taxSaved = Math.round(cents(assessment) * 3 / 100);
  const netBeforeTax = (rent) => rent * 6 - deductible;
  const incomeTaxAt = (rent) => Math.round(Math.max(0, netBeforeTax(rent)) * taxRate / 100);
  const net = (rent) => netBeforeTax(rent) - incomeTaxAt(rent) - other;
  const gainAt = (rent) => net(rent) + taxSaved;

  let breakEvenRent = null;
  const remainingCosts = other - taxSaved;
  if (gainAt(0) >= 0) {
    breakEvenRent = 0;
  } else if (taxRate < 100 || remainingCosts <= 0) {
    // Find the first cent of monthly rent for which cash flow equals or beats vacancy.
    const grossTarget = deductible + (remainingCosts > 0
      ? remainingCosts / (1 - taxRate / 100)
      : remainingCosts);
    if (grossTarget < Number.MAX_SAFE_INTEGER) {
      let low = 0;
      let high = Math.ceil(grossTarget / 6) + 1;
      while (low < high) {
        const middle = low + Math.floor((high - low) / 2);
        if (gainAt(middle) >= 0) high = middle;
        else low = middle + 1;
      }
      breakEvenRent = money(low);
    }
  }

  const rent = cents(monthlyRent);
  return {
    grossRent: money(rent * 6),
    incomeTax: money(incomeTaxAt(rent)),
    netRentalIncome: money(net(rent)),
    taxSaved: money(taxSaved),
    gain: money(gainAt(rent)),
    breakEvenRent,
  };
}
