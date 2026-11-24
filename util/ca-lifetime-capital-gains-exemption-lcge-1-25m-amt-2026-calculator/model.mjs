export const LCGE_LIMIT = 1_275_000;
export const REGULAR_INCLUSION = 0.5;
export const FEDERAL_AMT_EXEMPTION = 181_440;
export const FEDERAL_AMT_RATE = 0.205;
export const LCGE_AMT_INCLUSION = 0.30;
export const QUEBEC_AMT_EXEMPTION = 183_680;
export const QUEBEC_AMT_RATE = 0.19;
export const RECOVERY_YEARS = 7;
export const PROVINCIAL_FACTORS = Object.freeze({
  federal: 0,
  onScenario: 0.3367,
  bc: 0.349,
  bcScenario: 0.337,
  ab: 0.35,
  qc: 0,
});

function validateAmount(value, label, max = 1_000_000_000) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`${label} must be between 0 and ${max.toLocaleString('en-CA')}.`);
  }
}

export function calculateSale({
  gain, priorLCGE, otherIncome, combinedRate, regularFederalTax,
  province, regularQuebecTax = 0, holders,
}) {
  validateAmount(gain, 'Total capital gain');
  validateAmount(priorLCGE, 'Prior LCGE used per claimant');
  validateAmount(otherIncome, 'Other taxable income per claimant');
  validateAmount(combinedRate, 'Combined marginal rate', 100);
  validateAmount(regularFederalTax, 'Regular federal tax per claimant');
  if (!Object.hasOwn(PROVINCIAL_FACTORS, province)) throw new RangeError('Select a province or scenario.');
  if (!Number.isInteger(holders) || holders < 1 || holders > 100) {
    throw new RangeError('Enter a whole number of claimants from 1 to 100.');
  }

  const gainPerPerson = gain / holders;
  const remainingLCGE = Math.max(0, LCGE_LIMIT - priorLCGE);
  const exempt = Math.min(gainPerPerson, remainingLCGE);
  const excess = gainPerPerson - exempt;
  const regularGainTax = excess * REGULAR_INCLUSION * combinedRate / 100;
  const amtATI = otherIncome + LCGE_AMT_INCLUSION * exempt + excess;
  const federalMinimumTax = Math.max(0, amtATI - FEDERAL_AMT_EXEMPTION) * FEDERAL_AMT_RATE;
  const federalExtra = Math.max(0, federalMinimumTax - regularFederalTax);
  const provincialFactor = PROVINCIAL_FACTORS[province];
  let quebecMinimumTax = null;
  let provincialExtra = federalExtra * provincialFactor;

  if (province === 'qc') {
    validateAmount(regularQuebecTax, 'Regular Québec tax per claimant');
    quebecMinimumTax = Math.max(0, amtATI - QUEBEC_AMT_EXEMPTION) * QUEBEC_AMT_RATE;
    provincialExtra = Math.max(0, quebecMinimumTax - regularQuebecTax);
  }

  return {
    gainPerPerson, remainingLCGE, regularGainTax, amtATI, federalMinimumTax, quebecMinimumTax,
    federalExtra, provincialExtra, provincialFactor, holders, province,
    groupRemainingLCGE: remainingLCGE * holders,
    exemptGain: exempt * holders,
    excessGain: excess * holders,
    totalRegularGainTax: regularGainTax * holders,
    totalExtraAMT: (federalExtra + provincialExtra) * holders,
  };
}

export function simulateRecovery(sale, {
  regularFederal, minimumFederal, regularQuebec = 0, minimumQuebec = 0,
}) {
  validateAmount(regularFederal, 'Future regular federal tax');
  validateAmount(minimumFederal, 'Future federal minimum tax');
  const federalRoom = Math.max(0, regularFederal - minimumFederal);
  const isQuebec = sale.province === 'qc';
  if (isQuebec) {
    validateAmount(regularQuebec, 'Future regular Québec tax');
    validateAmount(minimumQuebec, 'Future Québec minimum tax');
  }
  const quebecRoom = isQuebec ? Math.max(0, regularQuebec - minimumQuebec) : 0;
  let federalLeft = sale.federalExtra;
  let provincialLeft = sale.provincialExtra;

  const years = Array.from({ length: RECOVERY_YEARS }, (_, index) => {
    const federal = Math.min(federalLeft, federalRoom);
    const provincial = Math.min(provincialLeft, isQuebec ? quebecRoom : federal * sale.provincialFactor);
    federalLeft -= federal;
    provincialLeft -= provincial;
    return {
      year: 2027 + index,
      federal: federal * sale.holders,
      provincial: provincial * sale.holders,
      remaining: (federalLeft + provincialLeft) * sale.holders,
    };
  });

  const expired = (federalLeft + provincialLeft) * sale.holders;
  return {
    years, expired, recovered: sale.totalExtraAMT - expired,
    federalTaxNeededPerYear: annualTaxTarget(sale.federalExtra, minimumFederal),
    quebecTaxNeededPerYear: isQuebec ? annualTaxTarget(sale.provincialExtra, minimumQuebec) : 0,
  };
}

function annualTaxTarget(credit, minimum) {
  if (credit === 0) return 0;
  // Round up so entering the displayed target leaves enough room to use the full credit.
  return Math.ceil((minimum + credit / RECOVERY_YEARS) * 100) / 100;
}
