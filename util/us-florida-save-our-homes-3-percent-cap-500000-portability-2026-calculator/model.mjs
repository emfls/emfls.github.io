export const constants = Object.freeze({
  taxYear: 2026,
  filingDeadline: 'March 2, 2026',
  statutoryCap: 0.03,
  sohCap: 0.027,
  portabilityCap: 500000,
  baseExemption: 25000,
  additionalThreshold: 50000,
  additionalExemption: 26411,
});

function requireRange(value, min, max, name) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter a valid ${name}.`);
  }
}

export function portability(oldMarketValue, oldAssessedValue, newMarketValue) {
  requireRange(oldMarketValue, 1, Number.MAX_SAFE_INTEGER, 'old just value');
  requireRange(oldAssessedValue, 0, Number.MAX_SAFE_INTEGER, 'old assessed value');
  requireRange(newMarketValue, 1, Number.MAX_SAFE_INTEGER, 'new just value');

  const oldBenefit = Math.max(0, oldMarketValue - oldAssessedValue);
  const upsizing = newMarketValue >= oldMarketValue;
  const uncappedBenefit = upsizing ? oldBenefit : newMarketValue * (oldBenefit / oldMarketValue);
  return {
    mode: upsizing ? 'UPSIZING' : 'DOWNSIZING',
    oldBenefit,
    uncappedBenefit,
    portableBenefit: Math.min(constants.portabilityCap, uncappedBenefit),
    capped: uncappedBenefit > constants.portabilityCap,
  };
}

// From 2027 the statewide non-school exemption starts at the first dollar.
export function taxableValues(assessed, nonSchoolExemption = null) {
  const school = Math.max(0, assessed - constants.baseExemption);
  const additional = Math.min(constants.additionalExemption, Math.max(0, assessed - constants.additionalThreshold));
  return {
    school,
    nonSchool: nonSchoolExemption === null ? school - additional : Math.max(0, assessed - nonSchoolExemption),
  };
}

export function nextAssessment(previous, justValue, cpi = constants.sohCap) {
  return Math.min(justValue, previous * (1 + Math.min(constants.statutoryCap, cpi)));
}

export function filingWindow(lastExemptionYear) {
  if (!Number.isInteger(lastExemptionYear) || lastExemptionYear < 1995 || lastExemptionYear >= constants.taxYear) {
    throw new RangeError('Enter the last January 1 exemption year between 1995 and 2025.');
  }

  const lastEstablishmentYear = lastExemptionYear + 3;
  const eligible = constants.taxYear <= lastEstablishmentYear;
  return { eligible, lastEstablishmentYear, filingYear: eligible ? constants.taxYear : null };
}

export function calculate({
  oldMarketValue, oldAssessedValue, newMarketValue, schoolMills, nonSchoolMills,
  lastExemptionYear, marketGrowth = 0.04, futureCpi = constants.sohCap,
}) {
  requireRange(schoolMills, 0, 100, 'school millage (0–100)');
  requireRange(nonSchoolMills, 0, 100, 'non-school millage (0–100)');
  requireRange(marketGrowth, -1, 1, 'annual market growth (−100% to 100%)');
  requireRange(futureCpi, -1, 1, 'future CPI change (−100% to 100%)');

  const transfer = portability(oldMarketValue, oldAssessedValue, newMarketValue);
  const window = filingWindow(lastExemptionYear);
  const portableBenefit = window.eligible ? transfer.portableBenefit : 0;
  const newInitialAssessedValue = Math.max(0, newMarketValue - portableBenefit);
  let withAssessment = newInitialAssessedValue;
  let withoutAssessment = newMarketValue;
  let justValue = newMarketValue;

  function estimate(assessed, nonSchoolExemption) {
    const taxable = taxableValues(assessed, nonSchoolExemption);
    const tax = (taxable.school * schoolMills + taxable.nonSchool * nonSchoolMills) / 1000;
    return { assessed, taxable, tax };
  }

  const projection = Array.from({ length: 10 }, (_, index) => {
    const year = constants.taxYear + index;
    let nonSchoolExemption = null;
    if (index > 0) {
      justValue *= 1 + marketGrowth;
      withAssessment = nextAssessment(withAssessment, justValue, futureCpi);
      withoutAssessment = nextAssessment(withoutAssessment, justValue, futureCpi);
      nonSchoolExemption = year === 2027 ? 150000 : 250000 * ((1 + Math.max(0, futureCpi)) ** (year - 2028));
    }

    const withPortability = estimate(withAssessment, nonSchoolExemption);
    const withoutPortability = estimate(withoutAssessment, nonSchoolExemption);
    return { year, justValue, nonSchoolExemption, withPortability, withoutPortability, savings: withoutPortability.tax - withPortability.tax };
  });

  return {
    ...transfer,
    capped: window.eligible && transfer.capped,
    portableBenefit,
    newInitialAssessedValue,
    window,
    firstYear: projection[0],
    projection,
    totalSavings: projection.reduce((total, row) => total + row.savings, 0),
  };
}
