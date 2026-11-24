const INSURED_CAP_CENTS = 150_000_000;
const FIRST_TIER_CENTS = 50_000_000;
const GDS_LIMIT = 0.39;
const TDS_LIMIT = 0.44;
const TAX_PERCENT = Object.freeze({
  AB: 0, BC: 0, MB: 0, NB: 0, NL: 0, NS: 0, NT: 0, NU: 0,
  ON: 8, PE: 0, QC: 9, SK: 6, YT: 0,
});

function assertRange(value, label, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
}

function minimumDownCents(price) {
  if (price >= INSURED_CAP_CENTS) return Math.ceil(price / 5);
  if (price <= FIRST_TIER_CENTS) return Math.ceil(price / 20);
  return 2_500_000 + Math.ceil((price - FIRST_TIER_CENTS) / 10);
}

export function minimumDownPayment(price) {
  assertRange(price, 'Purchase price', 0.01, 1_000_000_000);
  return minimumDownCents(Math.round(price * 100)) / 100;
}

export function qualifyingRate(contractRate) {
  assertRange(contractRate, 'Contract rate', 0, 100);
  return Math.max(5.25, contractRate + 2);
}

export function premiumRate(ltv, amortization = 25) {
  assertRange(ltv, 'Loan-to-value percentage', 0, 95);
  if (ltv <= 80) return 0;
  if (amortization > 25) return ltv <= 85 ? 3 : ltv <= 90 ? 3.3 : 4.2;
  return ltv <= 85 ? 2.8 : ltv <= 90 ? 3.1 : 4;
}

export function provincialPremiumTaxRate(province) {
  if (!Object.hasOwn(TAX_PERCENT, province)) throw new RangeError('Select a Canadian province or territory.');
  return TAX_PERCENT[province];
}

export function monthlyPayment(principal, ratePercent, years) {
  assertRange(principal, 'Mortgage principal', 0, Number.MAX_SAFE_INTEGER);
  assertRange(ratePercent, 'Annual rate', 0, 102);
  assertRange(years, 'Amortization', 1, 30);
  const months = years * 12;
  if (ratePercent === 0) return principal / months;

  // log1p and expm1 evaluate Canadian semi-annual compounding without cancellation near 0%.
  const logMonthlyGrowth = Math.log1p(ratePercent / 200) / 6;
  return principal * Math.expm1(logMonthlyGrowth) / -Math.expm1(-months * logMonthlyGrowth);
}

function loanTerms(price, down, years, homeStartEligible) {
  const base = price - down;
  const ltv = base * 100 / price;
  const insured = ltv > 80;
  const effectiveAmortization = insured && !homeStartEligible ? Math.min(25, years) : years;
  const rate = premiumRate(ltv, effectiveAmortization);
  const premium = Math.round(base * Math.round(rate * 100) / 10_000);
  return {
    insured, ltv, effectiveAmortization, premiumRate: rate,
    baseLoan: base / 100, premium: premium / 100, totalMortgage: (base + premium) / 100,
  };
}

function withinLimit(value, limit) {
  return value <= limit + Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(limit)) * 8;
}

function maxPurchase(down, years, homeStartEligible, rate, budget) {
  // With a fixed down payment, minimum cash required and stress payment are
  // nondecreasing. Insurance and any reduction in amortization only raise payment
  // when LTV crosses 80%. A buyer who can clear the $1.5M cap is already uninsured.
  let low = down;
  let high = down >= INSURED_CAP_CENTS / 5 ? down * 5 : INSURED_CAP_CENTS - 1;
  while (low < high) {
    const candidate = low + Math.ceil((high - low) / 2);
    const eligible = down >= minimumDownCents(candidate);
    const terms = eligible && loanTerms(candidate, down, years, homeStartEligible);
    if (terms && withinLimit(monthlyPayment(terms.totalMortgage, rate, terms.effectiveAmortization), budget)) {
      low = candidate;
    } else {
      high = candidate - 1;
    }
  }
  return low === down ? { maxHomePrice: null, mortgageAtMaxPrice: null } : {
    maxHomePrice: low / 100,
    mortgageAtMaxPrice: loanTerms(low, down, years, homeStartEligible).totalMortgage,
  };
}

function roundRequiredUp(amount) {
  const cents = Math.max(0, amount) * 100;
  return Math.ceil(cents - Number.EPSILON * Math.max(1, cents) * 8) / 100;
}

export function calculateMortgage(input) {
  const {
    price, downPayment, contractRate, amortization, province, firstTime, newBuild,
    annualIncome, monthlyPropertyTax, monthlyHeating, monthlyCondoFees, otherMonthlyDebts,
  } = input;
  const minimumDown = minimumDownPayment(price);
  assertRange(downPayment, 'Down payment', 0, price);
  assertRange(annualIncome, 'Gross annual household income', 0.01, 100_000_000);
  assertRange(amortization, 'Amortization', 1, 30);
  if (!Number.isInteger(amortization)) throw new RangeError('Amortization must be in whole years.');
  for (const [label, value] of [
    ['Monthly property tax', monthlyPropertyTax], ['Monthly heating', monthlyHeating],
    ['Monthly condo fees', monthlyCondoFees], ['Other monthly debt payments', otherMonthlyDebts],
  ]) {
    assertRange(value, label, 0, 100_000_000);
  }

  const rate = qualifyingRate(contractRate);
  const taxRate = provincialPremiumTaxRate(province);
  const down = Math.round(downPayment * 100);
  const homeStartEligible = firstTime === true || newBuild === true;
  const income = annualIncome / 12;
  const housingCosts = monthlyPropertyTax + monthlyHeating + monthlyCondoFees / 2;
  const gdsBudget = income * GDS_LIMIT - housingCosts;
  const tdsBudget = income * TDS_LIMIT - housingCosts - otherMonthlyDebts;
  const paymentBudget = Math.min(gdsBudget, tdsBudget);
  const downPaymentShortfall = Math.max(0, Math.round(minimumDown * 100) - down) / 100;
  const common = {
    qualifyingRate: rate, taxRate, minimumDown, downPaymentShortfall,
    ...maxPurchase(down, amortization, homeStartEligible, rate, paymentBudget),
  };
  if (downPaymentShortfall > 0) return { ...common, passes: false, totalMortgage: null };

  const terms = loanTerms(Math.round(price * 100), down, amortization, homeStartEligible);
  const { effectiveAmortization, totalMortgage } = terms;
  const actualPayment = monthlyPayment(totalMortgage, contractRate, effectiveAmortization);
  const paymentFactor = monthlyPayment(1, rate, effectiveAmortization);
  const stressPayment = monthlyPayment(totalMortgage, rate, effectiveAmortization);
  const housing = stressPayment + housingCosts;
  const totalDebt = housing + otherMonthlyDebts;
  const gdsPass = withinLimit(housing, income * GDS_LIMIT);
  const tdsPass = withinLimit(totalDebt, income * TDS_LIMIT);
  const premiumTaxCents = Math.round(Math.round(terms.premium * 100) * taxRate / 100);
  const requiredAnnualIncome = Math.max(housing / GDS_LIMIT, totalDebt / TDS_LIMIT) * 12;

  return {
    ...common, ...terms, actualPayment, stressPayment,
    premiumTax: premiumTaxCents / 100,
    downPaymentAndTax: (down + premiumTaxCents) / 100,
    gds: housing / income * 100,
    tds: totalDebt / income * 100,
    gdsPass, tdsPass, passes: gdsPass && tdsPass,
    annualIncomeIncrease: gdsPass && tdsPass ? 0 : roundRequiredUp(requiredAnnualIncome - annualIncome),
    monthlyDebtReduction: !gdsPass ? null : tdsPass ? 0 : roundRequiredUp(totalDebt - income * TDS_LIMIT),
    maxQualifyingMortgage: Math.max(0, Math.floor(paymentBudget / paymentFactor * 100)) / 100,
  };
}
