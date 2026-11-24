const SDI_RATE = 130;
const OLD_SDI_RATE = 90;
const OLD_SDI_CAP = 153164;
const SOCIAL_SECURITY_RATE = 620;
const SOCIAL_SECURITY_CAP = 184500;
const MEDICARE_RATE = 145;
const ADDITIONAL_MEDICARE_RATE = 90;
const EMPLOYER_MEDICARE_THRESHOLD = 200000;
const BEHAVIORAL_HEALTH_RATE = 100;
const BEHAVIORAL_HEALTH_THRESHOLD = 1000000;
const WA_PAID_LEAVE_RATE = 113;
const WA_EMPLOYEE_SHARE = 0.7143;
const WA_CARES_RATE = 58;
const CA_RATES = [100, 200, 400, 600, 800, 930, 1030, 1130, 1230];
const FEDERAL_RATES = [1000, 1200, 2200, 2400, 3200, 3500, 3700];

const FILING = {
  single: {
    caDeduction: 5900,
    caStarts: [0, 11456, 27157, 42861, 59498, 75197, 384109, 460927, 768213],
    federalDeduction: 16100,
    federalStarts: [0, 12400, 50400, 105700, 201775, 256225, 640600],
    medicareThreshold: 200000,
  },
  joint: {
    caDeduction: 11800,
    caStarts: [0, 22912, 54314, 85722, 118996, 150394, 768218, 921854, 1536426],
    federalDeduction: 32200,
    federalStarts: [0, 24800, 100800, 211400, 403550, 512450, 768700],
    medicareThreshold: 250000,
  },
};

function wageCents(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1e9 || value !== Math.round(value * 100) / 100) {
    throw new RangeError('Enter each wage as a dollar amount from $0 to $1 billion with up to two decimal places.');
  }
  return Math.round(value * 100);
}

function progressive(cents, starts, rates, deduction) {
  const taxable = Math.max(0, cents - deduction * 100);
  let weighted = 0;
  let rate = 0;
  for (const [index, start] of starts.entries()) {
    if (start * 100 > taxable) break;
    const end = (starts[index + 1] ?? Infinity) * 100;
    weighted += (Math.min(taxable, end) - start * 100) * rates[index];
    rate = rates[index];
  }
  return {
    taxable,
    tax: Math.round(weighted / 10000),
    rate: cents >= deduction * 100 ? rate : 0,
  };
}

// One employee in covered employment. Rates are basis points and amounts
// are calculated in cents before conversion to dollars for the caller.
export function calculate({
  salary = 0, rsu = 0, bonus = 0, nso = 0, payPeriods = 26, status = 'single',
} = {}) {
  if (status !== 'single' && status !== 'joint') throw new RangeError('Choose a filing status.');
  if (!Number.isInteger(payPeriods) || payPeriods < 1 || payPeriods > 365) {
    throw new RangeError('Enter a whole number from 1 to 365 for annual pay periods.');
  }

  const gross = [salary, rsu, bonus, nso].map(wageCents).reduce((sum, wage) => sum + wage, 0);
  const filing = FILING[status];
  const tax = (cents, rate) => Math.round(cents * rate / 10000);
  const above = (cents, threshold) => Math.max(0, cents - threshold * 100);
  const sdi = tax(gross, SDI_RATE);
  const oldSdi = tax(Math.min(gross, OLD_SDI_CAP * 100), OLD_SDI_RATE);
  const socialSecurity = tax(Math.min(gross, SOCIAL_SECURITY_CAP * 100), SOCIAL_SECURITY_RATE);
  const medicare = tax(gross, MEDICARE_RATE);
  const additionalMedicare = tax(above(gross, filing.medicareThreshold), ADDITIONAL_MEDICARE_RATE);
  const employerAdditionalMedicare = tax(above(gross, EMPLOYER_MEDICARE_THRESHOLD), ADDITIONAL_MEDICARE_RATE);
  const ca = progressive(gross, filing.caStarts, CA_RATES, filing.caDeduction);
  const federal = progressive(gross, filing.federalStarts, FEDERAL_RATES, filing.federalDeduction);
  const behavioralHealth = tax(above(ca.taxable, BEHAVIORAL_HEALTH_THRESHOLD), BEHAVIORAL_HEALTH_RATE);
  const caStateTotal = sdi + ca.tax + behavioralHealth;
  const total = caStateTotal + federal.tax + socialSecurity + medicare + additionalMedicare;

  const caMarginal = ca.rate + SDI_RATE
    + (ca.taxable >= BEHAVIORAL_HEALTH_THRESHOLD * 100 ? BEHAVIORAL_HEALTH_RATE : 0);
  const combinedMarginal = caMarginal + federal.rate + MEDICARE_RATE
    + (gross < SOCIAL_SECURITY_CAP * 100 ? SOCIAL_SECURITY_RATE : 0)
    + (gross >= filing.medicareThreshold * 100 ? ADDITIONAL_MEDICARE_RATE : 0);

  const waPaidLeave = tax(Math.min(gross, SOCIAL_SECURITY_CAP * 100), WA_PAID_LEAVE_RATE * WA_EMPLOYEE_SHARE);
  const waCares = tax(gross, WA_CARES_RATE);

  return {
    gross: gross / 100,
    sdi: sdi / 100,
    oldSdi: oldSdi / 100,
    perPaycheck: Math.round(sdi / payPeriods) / 100,
    sdiIncrease: (sdi - oldSdi) / 100,
    fiveYearSdi: sdi * 5 / 100,
    caTaxable: ca.taxable / 100,
    caIncome: ca.tax / 100,
    behavioralHealth: behavioralHealth / 100,
    caStateTotal: caStateTotal / 100,
    caMarginalRate: caMarginal / 10000,
    federalTaxable: federal.taxable / 100,
    federalIncome: federal.tax / 100,
    socialSecurity: socialSecurity / 100,
    medicare: medicare / 100,
    additionalMedicare: additionalMedicare / 100,
    employerAdditionalMedicare: employerAdditionalMedicare / 100,
    combinedMarginalRate: combinedMarginal / 10000,
    effectiveRate: gross ? total / gross : 0,
    total: total / 100,
    txStateTotal: 0,
    flStateTotal: 0,
    waPaidLeave: waPaidLeave / 100,
    waCares: waCares / 100,
    waStateTotal: (waPaidLeave + waCares) / 100,
  };
}
