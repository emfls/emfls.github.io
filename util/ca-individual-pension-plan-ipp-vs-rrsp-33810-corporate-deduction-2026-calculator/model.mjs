export const parameters = Object.freeze({
  year: 2026,
  rrspLimit: 33_810,
  rrspRate: 0.18,
  mpLimit: 35_390,
  dbLimit: 3_932.22,
  salaryForFullIppEstimate: 192_500,
  valuationRate: 0.075,
  valuationInterval: 3,
  firstHistoricalYear: 1991,
  minAge: 35,
  maxAge: 71,
  projectionYears: 10,
});

export const currentServiceSchedule = Object.freeze([
  [35, 33_810], [40, 37_100], [45, 40_800], [50, 44_900],
  [55, 49_300], [60, 54_100], [65, 56_300], [71, 56_300],
].map(pair => Object.freeze(pair)));

function between(value, min, max, label, whole = false) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    throw new RangeError(`${label} must be ${whole ? 'a whole number' : 'a number'} from ${min.toLocaleString('en-CA')} to ${max.toLocaleString('en-CA')}.`);
  }
  return value;
}

export function rrspRoom(priorSalary) {
  between(priorSalary, 0, 10_000_000, 'Prior-year T4 salary');
  return Math.min(parameters.rrspLimit, parameters.rrspRate * priorSalary);
}

export function currentService(age, salary) {
  between(age, parameters.minAge, parameters.maxAge, 'Age');
  between(salary, 0, 10_000_000, 'T4 salary');
  const upperIndex = currentServiceSchedule.findIndex(([anchorAge], index) => index > 0 && age <= anchorAge);
  const [lowerAge, lowerAmount] = currentServiceSchedule[upperIndex - 1];
  const [upperAge, upperAmount] = currentServiceSchedule[upperIndex];
  const atFullSalary = lowerAmount + (upperAmount - lowerAmount) * (age - lowerAge) / (upperAge - lowerAge);
  return atFullSalary * Math.min(1, salary / parameters.salaryForFullIppEstimate);
}

export function maxEligiblePastYears(firstServiceYear) {
  between(firstServiceYear, 1900, parameters.year, 'First corporate T4 year', true);
  return parameters.year - Math.max(parameters.firstHistoricalYear, firstServiceYear);
}

export function estimate({
  age, priorSalary, salary, firstServiceYear, pastYears, pastSalary, transfer,
  actualReturn, corporateRate, setupFee, annualFee,
}) {
  between(age, parameters.minAge, parameters.maxAge, 'Age', true);
  const maxPastYears = maxEligiblePastYears(firstServiceYear);
  between(pastYears, 0, maxPastYears, 'Eligible past-service years', true);
  between(transfer, 0, 100_000_000, 'Qualifying RRSP transfer');
  between(actualReturn, -100, 100, 'Annual portfolio return');
  between(corporateRate, 0, 100, 'Corporate tax rate');
  between(setupFee, 0, 1_000_000, 'Setup fee');
  between(annualFee, 0, 1_000_000, 'Annual fee');

  const rrsp = rrspRoom(priorSalary);
  const ipp = currentService(age, salary);
  const grossPast = pastYears * currentService(age, pastSalary);
  const appliedTransfer = Math.min(grossPast, transfer);
  const netPast = grossPast - appliedTransfer;
  const taxRate = corporateRate / 100;

  let actualAssets = grossPast;
  let benchmarkAssets = grossPast;
  let operatingAdvantage = 0;
  let tenYearAdvantage = 0;
  let tenYearTaxSaved = 0;
  let totalTopUps = 0;
  let breakEvenYear = null;
  const years = [];
  for (let year = 1; year <= parameters.projectionYears; year += 1) {
    const yearAge = age + year - 1;
    const annualIpp = yearAge <= parameters.maxAge ? currentService(yearAge, salary) : 0;
    const annualRrsp = yearAge <= parameters.maxAge ? rrspRoom(year === 1 ? priorSalary : salary) : 0;
    actualAssets = actualAssets * (1 + actualReturn / 100) + annualIpp;
    benchmarkAssets = benchmarkAssets * (1 + parameters.valuationRate) + annualIpp;

    let topUp = 0;
    if (year % parameters.valuationInterval === 0) {
      // Each scenario valuation begins the next interval from the same funded balance.
      topUp = Math.max(0, benchmarkAssets - actualAssets);
      actualAssets += topUp;
      benchmarkAssets = actualAssets;
    }

    const fees = annualFee + (year === 1 ? setupFee : 0);
    const pastFunding = year === 1 ? netPast : 0;
    const afterTaxFees = fees * (1 - taxRate);
    const corporateDeduction = annualIpp + pastFunding + topUp + fees;
    const corporateTaxSaved = corporateDeduction * taxRate;
    const netAdvantage = annualIpp - annualRrsp + pastFunding + topUp - afterTaxFees;
    operatingAdvantage += annualIpp - annualRrsp - afterTaxFees;
    if (breakEvenYear === null && operatingAdvantage >= -1e-8) breakEvenYear = year;
    tenYearAdvantage += netAdvantage;
    tenYearTaxSaved += corporateTaxSaved;
    totalTopUps += topUp;
    years.push({
      year, age: yearAge, ipp: annualIpp, rrsp: annualRrsp, pastFunding, topUp,
      afterTaxFees, corporateDeduction, corporateTaxSaved, netAdvantage, cumulativeAdvantage: tenYearAdvantage,
    });
  }

  return {
    rrsp, ipp, maxPastYears, grossPast, appliedTransfer, netPast,
    annualExtra: ipp - rrsp,
    annualExtraAboveCap: ipp - parameters.rrspLimit,
    annualNetExtra: ipp - rrsp - annualFee * (1 - taxRate),
    yearOneDeduction: years[0].corporateDeduction,
    yearOneTaxSaved: years[0].corporateTaxSaved,
    tenYearAdvantage, tenYearTaxSaved, totalTopUps, breakEvenYear, years,
  };
}
