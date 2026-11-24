export const HELOC_LTV = 0.65;
export const COMBINED_LTV = 0.80;
export const CAPITAL_GAINS_INCLUSION = 0.50;

export const DEFAULTS = Object.freeze({
  homeValue: 850000, mortgageBalance: 610000, months: 300,
  mortgageRate: 0.0449, helocRate: 0.0605,
  expectedReturn: 0.07, dividendYield: 0.025,
  province: 'ON', taxableIncome: 125000, customRate: 0.40, capitalize: true,
});

// Each pair is the inclusive upper limit and the rate for that tranche.
const FEDERAL = [[58523, .14], [117045, .205], [181440, .26], [258482, .29], [Infinity, .33]];
const PROVINCES = {
  ON: [[53891, .0505], [107785, .0915], [150000, .1116], [220000, .1216], [Infinity, .1316]],
  BC: [[50363, .056], [100728, .077], [115648, .105], [140430, .1229], [190405, .147], [265545, .168], [Infinity, .205]],
  AB: [[61200, .08], [154259, .10], [185111, .12], [246813, .13], [370220, .14], [Infinity, .15]],
  QC: [[54345, .14], [108680, .19], [132245, .24], [Infinity, .2575]],
};
const EPSILON = 1e-7;

function requireRange(name, value, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`);
  }
}

function bracketTax(income, brackets) {
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of brackets) {
    tax += Math.max(0, Math.min(income, upper) - lower) * rate;
    if (income <= upper) break;
    lower = upper;
  }
  return tax;
}

export function marginalRates(province, income, customRate) {
  if (province === 'custom') {
    requireRange('customRate', customRate, 0, 1);
    return { federal: null, provincial: null, combined: customRate };
  }
  if (!Object.hasOwn(PROVINCES, province)) throw new RangeError('Unknown province.');
  requireRange('taxableIncome', income, 0, 100000000);
  const federal = FEDERAL.find(([upper]) => income < upper)[1] * (province === 'QC' ? .835 : 1);
  const brackets = PROVINCES[province];
  let provincial = brackets.find(([upper]) => income < upper)[1];
  if (province === 'ON') {
    const basicTax = bracketTax(income, brackets) - 12989 * .0505;
    if (basicTax >= 7446) provincial *= 1.56;
    else if (basicTax >= 5818) provincial *= 1.20;
  }
  return { federal, provincial, combined: federal + provincial };
}

export function monthlyMortgageRate(annualRate) {
  return Math.expm1(Math.log1p(annualRate / 2) / 6);
}

function scheduledPayment(balance, rate, months) {
  return rate === 0 ? balance / months : balance * rate / -Math.expm1(-months * Math.log1p(rate));
}

export function simulate(input) {
  const { homeValue, mortgageBalance, months, mortgageRate, helocRate, expectedReturn,
    dividendYield, province, taxableIncome, customRate, capitalize } = input;
  requireRange('homeValue', homeValue, 1, 100000000);
  requireRange('mortgageBalance', mortgageBalance, 0, 100000000);
  if (mortgageBalance > COMBINED_LTV * homeValue + EPSILON) {
    throw new RangeError('Starting mortgage exceeds the 80% combined loan limit.');
  }
  requireRange('months', months, 1, 480);
  if (!Number.isInteger(months)) throw new RangeError('months must be a whole number.');
  requireRange('mortgageRate', mortgageRate, 0, .50);
  requireRange('helocRate', helocRate, 0, .52);
  requireRange('expectedReturn', expectedReturn, -.97, .50);
  requireRange('dividendYield', dividendYield, 0, .25);
  const rates = marginalRates(province, taxableIncome, customRate);
  const limit = HELOC_LTV * homeValue;
  const rate = monthlyMortgageRate(mortgageRate);
  const payment = scheduledPayment(mortgageBalance, rate, months);
  const logRate = Math.log1p(rate);
  const monthlyReturn = Math.expm1(Math.log1p(expectedReturn) / 12);
  const monthlyYield = dividendYield / 12;

  let mortgage = mortgageBalance;
  let traditional = mortgageBalance;
  let heloc = 0;
  let investedDebt = 0;
  let portfolio = 0;
  let costBasis = 0;
  const gatePaydown = Math.max(0, mortgage - limit);
  let gateMonth = gatePaydown > EPSILON ? null : 0;
  let firstDrawMonth = null;
  let payoffMonth = mortgage > EPSILON ? null : 0;
  let traditionalPayoffMonth = payoffMonth;
  let yearInterest = 0;
  let yearDistributions = 0;
  let totalRefund = 0;
  let refundPrepayments = 0;
  let refundCash = 0;
  let cashHelocInterest = 0;
  let capitalizedInterest = 0;
  let helocInterest = 0;
  let deductibleInterest = 0;
  let cashDifference = 0;
  const rows = [];

  for (let month = 1; month <= months; month += 1) {
    // Draws occur at month-end and earn returns and incur interest from the next month.
    const interest = heloc * helocRate / 12;
    const eligibleInterest = investedDebt * helocRate / 12;
    yearInterest += eligibleInterest;
    deductibleInterest += eligibleInterest;
    helocInterest += interest;
    const distribution = portfolio * monthlyYield;
    const distributionTax = distribution * rates.combined;
    yearDistributions += distribution;
    portfolio += portfolio * monthlyReturn - distributionTax;
    costBasis += distribution - distributionTax;

    const oldMortgage = mortgage;
    const remaining = months - month;
    // Present value of the remaining payments avoids growing rounding error over long terms.
    const nextTraditional = rate === 0 ? payment * remaining : payment * -Math.expm1(-remaining * logRate) / rate;
    const baselinePaid = traditional - nextTraditional + traditional * rate;
    // Prior prepayments save a month of interest at the same scheduled payment.
    mortgage = Math.max(0, nextTraditional - (traditional - oldMortgage) * (1 + rate));
    const principal = oldMortgage - mortgage;
    const scheduledPaid = principal + oldMortgage * rate;
    traditional = nextTraditional;
    let refund = 0;
    let refundPrepayment = 0;
    if (month % 12 === 0 || month === months) {
      if (province === 'QC') {
        const saleIncome = month === months ? Math.max(0, portfolio - costBasis) * CAPITAL_GAINS_INCLUSION : 0;
        refund = yearInterest * rates.federal + Math.min(yearInterest, yearDistributions + saleIncome) * rates.provincial;
      } else {
        refund = yearInterest * rates.combined;
      }
      refundPrepayment = Math.min(mortgage, refund);
      mortgage -= refundPrepayment;
      totalRefund += refund;
      refundPrepayments += refundPrepayment;
      refundCash += refund - refundPrepayment;
      yearInterest = 0;
      yearDistributions = 0;
    }

    if (gateMonth === null && mortgage <= limit + EPSILON) gateMonth = month;
    const roomBefore = Math.max(0, limit - oldMortgage - heloc);
    const roomAfter = Math.max(0, limit - mortgage - heloc);
    const interestDraw = capitalize ? Math.min(interest, roomAfter) : 0;
    const investmentDraw = Math.min(roomAfter - interestDraw, Math.max(0, roomAfter - roomBefore));
    if (firstDrawMonth === null && investmentDraw > EPSILON) firstDrawMonth = month;
    heloc += interestDraw + investmentDraw;
    investedDebt += investmentDraw;
    portfolio += investmentDraw;
    costBasis += investmentDraw;
    const cashInterest = interest - interestDraw;
    capitalizedInterest += interestDraw;
    cashHelocInterest += cashInterest;
    cashDifference += baselinePaid - scheduledPaid - cashInterest + refund - refundPrepayment;
    if (payoffMonth === null && mortgage <= EPSILON) payoffMonth = month;
    if (traditionalPayoffMonth === null && traditional <= EPSILON) traditionalPayoffMonth = month;
    rows.push({ month, mortgage, traditional, heloc, portfolio, principal,
      investmentDraw, interestDraw, helocInterest: interest, cashInterest, refund, refundPrepayment });
  }

  const capitalGainsTax = Math.max(0, portfolio - costBasis) * CAPITAL_GAINS_INCLUSION * rates.combined;
  const netAdvantage = portfolio - capitalGainsTax - heloc + traditional - mortgage + cashDifference;
  return { rates, payment, startingLtv: mortgageBalance / homeValue, gatePaydown, gateMonth, firstDrawMonth,
    payoffMonth, traditionalPayoffMonth, monthsSaved: (traditionalPayoffMonth ?? months) - (payoffMonth ?? months),
    helocInterest, deductibleInterest, capitalizedInterest, cashHelocInterest, totalRefund, refundPrepayments,
    refundCash, portfolio, costBasis, capitalGainsTax, endingHeloc: heloc, endingMortgage: mortgage,
    endingTraditionalMortgage: traditional, cashDifference, netAdvantage, rows };
}

export function compareScenarios(input) {
  return {
    base: simulate(input),
    higherHeloc: simulate({ ...input, helocRate: input.helocRate + .02 }),
    lowerReturn: simulate({ ...input, expectedReturn: input.expectedReturn - .02 }),
  };
}
