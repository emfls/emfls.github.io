export const PARAMETERS = Object.freeze({
  single: Object.freeze({
    maxFortnightly: 1237.70,
    incomeFreeArea: 226,
    comparisonIncomeFreeArea: 218,
    deemingThreshold: 66800,
    homeowner: Object.freeze({ freeArea: 333000, cutoff: 745750 }),
    nonHomeowner: Object.freeze({ freeArea: 600000, cutoff: 1012750 })
  }),
  couple: Object.freeze({
    maxFortnightly: 1866,
    incomeFreeArea: 396,
    comparisonIncomeFreeArea: 380,
    deemingThreshold: 110600,
    homeowner: Object.freeze({ freeArea: 499000, cutoff: 1121000 }),
    nonHomeowner: Object.freeze({ freeArea: 766000, cutoff: 1388000 })
  })
});

const FORTNIGHTS_PER_YEAR = 26;
const WORK_BONUS = 300;
const LOWER_DEEMING_RATE = 0.0175;
const UPPER_DEEMING_RATE = 0.0375;
const ASSET_TAPER_PER_THOUSAND = 3;
const INCOME_TAPER = 0.5;

export function calculatePension({
  household = 'single',
  housing = 'homeowner',
  incomeScenario = 'official',
  financialAssets = 0,
  otherAssets = 0,
  workIncome = 0,
  partnerWorkIncome = 0,
  otherIncome = 0
} = {}) {
  if (household !== 'single' && household !== 'couple') {
    throw new RangeError('Select a single person or a couple.');
  }
  if (housing !== 'homeowner' && housing !== 'nonHomeowner') {
    throw new RangeError('Select a homeownership status.');
  }
  if (incomeScenario !== 'official' && incomeScenario !== 'comparison') {
    throw new RangeError('Select an income free area scenario.');
  }
  for (const amount of [financialAssets, otherAssets, workIncome, partnerWorkIncome, otherIncome]) {
    if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Enter a valid non-negative amount for each field.');
    }
  }

  const rules = PARAMETERS[household];
  const { maxFortnightly, deemingThreshold } = rules;
  const { freeArea: assetFreeArea, cutoff: assetCutoff } = rules[housing];
  const incomeFreeArea = incomeScenario === 'comparison' ? rules.comparisonIncomeFreeArea : rules.incomeFreeArea;
  const assessableAssets = financialAssets + otherAssets;
  const assetsTestPension = Math.max(0, maxFortnightly -
    Math.max(0, (assessableAssets - assetFreeArea) / 1000) * ASSET_TAPER_PER_THOUSAND);

  const annualDeemedIncome = Math.min(financialAssets, deemingThreshold) * LOWER_DEEMING_RATE +
    Math.max(0, financialAssets - deemingThreshold) * UPPER_DEEMING_RATE;
  const fortnightlyDeemedIncome = annualDeemedIncome / FORTNIGHTS_PER_YEAR;
  const eligiblePartnerIncome = household === 'couple' ? partnerWorkIncome : 0;
  const workBonusApplied = Math.min(workIncome, WORK_BONUS) + Math.min(eligiblePartnerIncome, WORK_BONUS);
  const assessableWorkIncome = Math.max(0, workIncome - WORK_BONUS) +
    Math.max(0, eligiblePartnerIncome - WORK_BONUS);
  const assessableIncome = fortnightlyDeemedIncome + assessableWorkIncome + otherIncome;
  const incomeTestPension = Math.max(0, maxFortnightly -
    Math.max(0, assessableIncome - incomeFreeArea) * INCOME_TAPER);

  const payableFortnightlyPension = Math.min(assetsTestPension, incomeTestPension);
  let bindingTest = 'full';
  if (payableFortnightlyPension < maxFortnightly) {
    if (Math.abs(assetsTestPension - incomeTestPension) < 1e-9) {
      bindingTest = 'both';
    } else {
      bindingTest = assetsTestPension < incomeTestPension ? 'assets' : 'income';
    }
  }

  return {
    assetFreeArea, assetCutoff, incomeFreeArea, assessableAssets, annualDeemedIncome,
    fortnightlyDeemedIncome, workBonusApplied, assessableIncome, assetsTestPension,
    incomeTestPension, payableFortnightlyPension, bindingTest,
    annualPension: payableFortnightlyPension * FORTNIGHTS_PER_YEAR,
    pensionerConcessionCard: payableFortnightlyPension > 0
  };
}
