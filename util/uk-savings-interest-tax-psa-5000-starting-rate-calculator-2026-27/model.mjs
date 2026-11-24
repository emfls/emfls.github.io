// Keep interest at sub-penny precision until display. Integer units preserve
// band boundaries when interest is calculated from a balance and a decimal AER.
const UNITS_PER_POUND = 1_000_000;
const UNITS_PER_PENNY = 10_000;
const PERSONAL_ALLOWANCE = 12_570 * UNITS_PER_POUND;
const TAPER_START = 100_000 * UNITS_PER_POUND;
const STARTING_RATE_LIMIT = 5_000 * UNITS_PER_POUND;
const BASIC_GROSS_TOP = 50_270 * UNITS_PER_POUND;
const BASIC_TAXABLE_TOP = 37_700 * UNITS_PER_POUND;
const HIGHER_TOP = 125_140 * UNITS_PER_POUND;
const BASIC_PSA = 1_000 * UNITS_PER_POUND;
const HIGHER_PSA = 500 * UNITS_PER_POUND;

const positive = value => Math.max(0, value);
const pounds = units => units / UNITS_PER_POUND;

function hundredths(value, maximum, label) {
  const scaled = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > maximum || scaled / 100 !== value) {
    throw new RangeError(`${label} must be between 0 and ${maximum.toLocaleString('en-GB')} with up to two decimal places.`);
  }
  return scaled;
}

function savingsBands(income, interest) {
  const total = income + interest;
  const personalAllowance = positive(PERSONAL_ALLOWANCE - positive(total - TAPER_START) / 2);
  const unusedPersonalAllowance = positive(personalAllowance - income);
  const nonSavingsTaxable = positive(income - personalAllowance);
  const startingRateAllowance = positive(STARTING_RATE_LIMIT - nonSavingsTaxable);
  const band = total > HIGHER_TOP ? 'Additional' : total > BASIC_GROSS_TOP ? 'Higher' : 'Basic';
  const psa = band === 'Basic' ? BASIC_PSA : band === 'Higher' ? HIGHER_PSA : 0;

  const allowanceUsed = Math.min(interest, unusedPersonalAllowance);
  const startingRateUsed = Math.min(interest - allowanceUsed, startingRateAllowance);
  const psaUsed = Math.min(interest - allowanceUsed - startingRateUsed, psa);
  const taxed = interest - allowanceUsed - startingRateUsed - psaUsed;

  // The 0% starting-rate and PSA slices still occupy space in the tax bands.
  const firstTaxedPound = nonSavingsTaxable + startingRateUsed + psaUsed;
  const basic = Math.min(taxed, positive(BASIC_TAXABLE_TOP - firstTaxedPound));
  const higher = Math.min(taxed, positive(HIGHER_TOP - firstTaxedPound)) - basic;
  const additional = taxed - basic - higher;

  return {
    band,
    psa: pounds(psa),
    personalAllowance: pounds(personalAllowance),
    unusedPersonalAllowance: pounds(unusedPersonalAllowance),
    startingRateAllowance: pounds(startingRateAllowance),
    zeroRated: {
      personalAllowance: pounds(allowanceUsed),
      startingRate: pounds(startingRateUsed),
      psa: pounds(psaUsed),
    },
    taxedInterest: pounds(taxed),
    basic, higher, additional,
  };
}

function maxTaxFreeBalance(income, otherInterest, aerBasisPoints) {
  const startingRate = positive(STARTING_RATE_LIMIT - positive(income - PERSONAL_ALLOWANCE));
  const allowances = positive(PERSONAL_ALLOWANCE - income) + startingRate;
  // Test the zero-tax allowance and the gross-income ceiling in both PSA bands.
  // Above the higher ceiling neither the standard PA nor either 0% band can help.
  const basicCeiling = Math.min(allowances + BASIC_PSA, BASIC_GROSS_TOP - income);
  const higherCeiling = Math.min(allowances + HIGHER_PSA, HIGHER_TOP - income);
  const interestRoom = Math.max(basicCeiling, higherCeiling) - otherInterest;
  if (aerBasisPoints === 0) return interestRoom >= 0 || otherInterest === 0 ? null : 0;
  return Math.floor(positive(interestRoom) / aerBasisPoints) / 100;
}

function weightedTax({ basic, higher, additional }, rates) {
  return basic * rates[0] + higher * rates[1] + additional * rates[2];
}

function scenario(income, otherInterest, baseline, balance, aer, deposit) {
  const outsideInterest = (balance - deposit) * aer;
  const grossInterest = balance * aer;
  const bands = savingsBands(income, outsideInterest + otherInterest);

  function year(rates) {
    const tax = weightedTax(bands, rates);
    const accountTax = tax - weightedTax(baseline, rates);
    const netInterest = pounds((grossInterest * 100 - accountTax) / 100);
    return {
      tax: pounds(tax / 100),
      accountTax: pounds(accountTax / 100),
      netInterest,
      netAer: balance === 0 ? null : netInterest / (balance / 100) * 100,
    };
  }

  const { basic, higher, additional, ...allowances } = bands;
  return {
    ...allowances,
    deposit: deposit / 100,
    outsideBalance: (balance - deposit) / 100,
    grossInterest: pounds(grossInterest),
    isaInterest: pounds(deposit * aer),
    interestByRate: { basic: pounds(basic), higher: pounds(higher), additional: pounds(additional) },
    y2026: year([20, 40, 45]),
    y2027: year([24, 44, 49]),
  };
}

export function calculateSavings({ nonSavingsIncome, balance, aer, otherInterest = 0, isaRoom = 20_000 }) {
  const income = hundredths(nonSavingsIncome, 100_000_000, 'Non-savings income') * UNITS_PER_PENNY;
  const balancePennies = hundredths(balance, 100_000_000, 'Savings balance');
  const aerBasisPoints = hundredths(aer, 100, 'AER');
  const outsideInterest = hundredths(otherInterest, 100_000_000, 'Other savings interest') * UNITS_PER_PENNY;
  const room = hundredths(isaRoom, 20_000, 'Available ISA allowance');
  const baseline = savingsBands(income, outsideInterest);
  const taxableAccount = scenario(income, outsideInterest, baseline, balancePennies, aerBasisPoints, 0);
  const cashIsa = scenario(income, outsideInterest, baseline, balancePennies, aerBasisPoints, Math.min(balancePennies, room));

  for (const key of ['y2026', 'y2027']) {
    cashIsa[key].taxSaved = taxableAccount[key].tax - cashIsa[key].tax;
  }
  return { taxFreeBalance: maxTaxFreeBalance(income, outsideInterest, aerBasisPoints), taxableAccount, cashIsa };
}
