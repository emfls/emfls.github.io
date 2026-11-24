// CRA's 2026 indexed amounts, using the standard federal Schedule 6 formula.
export const PARAMETERS = Object.freeze({
  basicFloor: 3000,
  disabilityFloor: 1150,
  phaseInRate: 0.27,
  phaseOutRate: 0.15,
  dualDisabilityPhaseOutRate: 0.075,
  disabilityMax: 860,
  secondaryExemptionCap: 16714,
  single: Object.freeze({ basicMax: 1665, basicStart: 27392, disabilityStart: 38495 }),
  family: Object.freeze({ basicMax: 2869, basicStart: 31251, disabilityStart: 50377 }),
});

const {
  basicFloor, disabilityFloor, phaseInRate, phaseOutRate,
  dualDisabilityPhaseOutRate, disabilityMax, secondaryExemptionCap,
} = PARAMETERS;

function householdParameters(household, dtc) {
  if (!['single', 'single_parent', 'couple'].includes(household)) {
    throw new RangeError('Select a valid household type.');
  }
  const allowedDtc = household === 'couple' ? ['none', 'primary', 'spouse', 'both'] : ['none', 'primary'];
  if (!allowedDtc.includes(dtc)) throw new RangeError('Select valid DTC eligibility for this household.');
  return household === 'single' ? PARAMETERS.single : PARAMETERS.family;
}

function incomeAmount(amount, label, working = false) {
  if (!Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER / 200 ||
      (working && amount < 0)) {
    throw new RangeError(`Enter a valid ${label} amount${working ? ' of zero or more' : ''}.`);
  }
  return Math.max(0, amount);
}

function cappedPhaseIn(work, floor, maximum) {
  return Math.min(maximum, Math.max(0, work - floor) * phaseInRate);
}

function afterPhaseOut(amount, net, threshold, rate) {
  return Math.max(0, amount - Math.max(0, net - threshold) * rate);
}

export function calculateCwb({
  household, primaryWork, primaryNet, spouseWork = 0, spouseNet = 0,
  dtc = 'none', fullTimeStudent = false, hasEligibleDependant = false,
}) {
  const parameters = householdParameters(household, dtc);
  const couple = household === 'couple';
  const work = [
    incomeAmount(primaryWork, 'primary working income', true),
    couple ? incomeAmount(spouseWork, 'spouse working income', true) : 0,
  ];
  const net = [
    incomeAmount(primaryNet, 'primary adjusted net income'),
    couple ? incomeAmount(spouseNet, 'spouse adjusted net income') : 0,
  ];
  const familyWork = work[0] + work[1];
  const familyNet = net[0] + net[1];
  const eligible = !fullTimeStudent || household === 'single_parent' || (couple && hasEligibleDependant);
  const dtcClaimants = {
    none: [],
    primary: [0],
    spouse: [1],
    both: [0, 1],
  }[dtc];
  const disabilityRate = dtc === 'both' ? dualDisabilityPhaseOutRate : phaseOutRate;

  function exemptionFor(claimant) {
    if (!couple) return 0;
    // On equal working incomes, Schedule 6 uses the other spouse's column.
    const partner = 1 - claimant;
    const lower = work[claimant] < work[partner] ? claimant : partner;
    return Math.min(work[lower], net[lower], secondaryExemptionCap);
  }

  const basicClaimant = dtc === 'spouse' ? 1 : 0;
  const secondaryExemption = exemptionFor(basicClaimant);
  const adjustedNet = familyNet - secondaryExemption;
  const basicBeforeReduction = cappedPhaseIn(familyWork, basicFloor, parameters.basicMax);

  function benefit(useExemption) {
    const basicNet = useExemption ? adjustedNet : familyNet;
    const basic = afterPhaseOut(basicBeforeReduction, basicNet, parameters.basicStart, phaseOutRate);
    const supplement = dtcClaimants.reduce((total, claimant) => {
      const claimantNet = familyNet - (useExemption ? exemptionFor(claimant) : 0);
      const capped = cappedPhaseIn(work[claimant], disabilityFloor, disabilityMax);
      return total + afterPhaseOut(capped, claimantNet, parameters.disabilityStart, disabilityRate);
    }, 0);
    return { basic, supplement };
  }

  const { basic, supplement } = eligible ? benefit(true) : { basic: 0, supplement: 0 };
  const baseline = eligible ? benefit(false) : { basic: 0, supplement: 0 };
  const annualTotal = basic + supplement;

  return {
    eligible, familyWork, familyNet, adjustedNet, secondaryExemption,
    basic, supplement, annualTotal,
    exemptionBoost: Math.max(0, annualTotal - (baseline.basic + baseline.supplement)),
    advanceTotal: annualTotal / 2,
    installment: annualTotal / 6,
    taxTimeBalance: annualTotal / 2,
  };
}

// A comparison curve using working income as adjusted net income before the
// exemption. For couples, each spouse earns half of the illustrated income.
export function buildBenefitCurve({ household, dtc = 'none' }) {
  const parameters = householdParameters(household, dtc);
  const adults = household === 'couple' ? 2 : 1;
  const grossFromAdjusted = (net) => adults === 2
    ? Math.min(net * 2, net + secondaryExemptionCap)
    : net;
  const basicEnd = parameters.basicStart + parameters.basicMax / phaseOutRate;
  const points = [
    0, basicFloor, basicFloor + parameters.basicMax / phaseInRate,
    grossFromAdjusted(parameters.basicStart), grossFromAdjusted(basicEnd),
  ];

  if (adults === 2) points.push(2 * secondaryExemptionCap);
  if (dtc !== 'none') {
    const disabilityRate = dtc === 'both' ? dualDisabilityPhaseOutRate : phaseOutRate;
    points.push(
      adults * disabilityFloor,
      adults * (disabilityFloor + disabilityMax / phaseInRate),
      grossFromAdjusted(parameters.disabilityStart),
      grossFromAdjusted(parameters.disabilityStart + disabilityMax / disabilityRate),
    );
  }

  const last = Math.ceil(Math.max(...points) / 5000) * 5000;
  for (let income = 5000; income <= last; income += 5000) points.push(income);

  const displayedIncomes = points.map((income) => Math.ceil(income * 100) / 100);
  return [...new Set(displayedIncomes)].sort((a, b) => a - b).map((income) => {
    const individualIncome = income / adults;
    const { basic, supplement, annualTotal, adjustedNet } = calculateCwb({
      household, dtc, primaryWork: individualIncome, primaryNet: individualIncome,
      spouseWork: individualIncome, spouseNet: individualIncome,
    });
    return { income, adjustedNet, basic, supplement, annualTotal };
  });
}
