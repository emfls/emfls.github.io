export const LIMITS = Object.freeze({
  rrspRate: 0.18, rrspAnnual: 33810, tfsaAnnual: 7000, tfsaCumulative: 109000,
  fhsaAnnual: 8000, fhsaCarry: 8000, fhsaLifetime: 40000, fhsaYears: 15,
  oasThreshold: 95323, oasRate: 0.15
});

function brackets(rows) {
  return Object.freeze(rows.map(Object.freeze));
}

export const FEDERAL = brackets([
  [58523, 0.14], [117045, 0.205], [181440, 0.26], [258482, 0.29], [Infinity, 0.33]
]);

export const PROVINCES = Object.freeze({
  ON: brackets([[53891, 0.0505], [107785, 0.0915], [150000, 0.1116], [220000, 0.1216], [Infinity, 0.1316]]),
  BC: brackets([[50363, 0.056], [100728, 0.077], [115648, 0.105], [140430, 0.1229], [190405, 0.147], [265545, 0.168], [Infinity, 0.205]]),
  AB: brackets([[61200, 0.08], [154259, 0.10], [185111, 0.12], [246813, 0.13], [370220, 0.14], [Infinity, 0.15]]),
  QC: brackets([[54345, 0.14], [108680, 0.19], [132245, 0.24], [Infinity, 0.2575]]),
  MB: brackets([[47564, 0.108], [101200, 0.1275], [Infinity, 0.174]]),
  SK: brackets([[54532, 0.105], [155805, 0.125], [Infinity, 0.145]]),
  NS: brackets([[30995, 0.0879], [61991, 0.1495], [97417, 0.1667], [157124, 0.175], [Infinity, 0.21]])
});

const PERSONAL = Object.freeze({
  ON: 12989, BC: 13216, AB: 22769, QC: 18952, MB: 15780, SK: 20381, NS: 11932
});
const MAX_MONEY = 1e9;

function bounded(value, max = MAX_MONEY) {
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? Math.min(max, Math.max(0, number)) : 0;
}

function toCents(value) {
  return Math.floor(value * 100 + 1e-7);
}

function phaseOut(income, from, to) {
  return Math.min(1, Math.max(0, (income - from) / (to - from)));
}

export function federalPersonalAmount(income) {
  return 16452 - 1623 * phaseOut(bounded(income), 181440, 258482);
}

export function manitobaPersonalAmount(income) {
  return 15780 * (1 - phaseOut(bounded(income), 200000, 400000));
}

function bracketTax(income, schedule) {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of schedule) {
    tax += (Math.min(income, upper) - lower) * rate;
    if (income <= upper) break;
    lower = upper;
  }
  return tax;
}

export function federalBracketTax(income) {
  return bracketTax(bounded(income), FEDERAL);
}

function provinceCode(province) {
  return Object.hasOwn(PROVINCES, province) ? province : 'ON';
}

function taxAt(income, province) {
  const schedule = PROVINCES[province];
  const personal = province === 'MB' ? manitobaPersonalAmount(income) : PERSONAL[province];
  const federal = Math.max(0, bracketTax(income, FEDERAL) - 0.14 * federalPersonalAmount(income));
  const regional = Math.max(0, bracketTax(income, schedule) - schedule[0][1] * personal);
  return federal * (province === 'QC' ? 0.835 : 1) + regional;
}

export function estimatedIncomeTax(income, province) {
  return taxAt(bounded(income), provinceCode(province));
}

export function rrspNewRoom(priorIncome, pensionAdjustment) {
  const newRoom = Math.min(LIMITS.rrspAnnual, bounded(priorIncome) * LIMITS.rrspRate);
  return Math.max(0, newRoom - bounded(pensionAdjustment));
}

function hasOverride(value) {
  return value != null && String(value).trim() !== '';
}

// Search in whole cents so displayed contributions stay within both room and cash.
function affordable(room, budget, cost) {
  let low = 0;
  let high = toCents(room);
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (cost(mid / 100) <= budget + 1e-8) low = mid;
    else high = mid - 1;
  }
  return low / 100;
}

export function calculate(input = {}) {
  const {
    income, province, retirementIncome, retirementRate, budget, budgetType, years, annualReturn,
    priorIncome, pensionAdjustment, rrspCarry, rrspRoom, tfsaRoom, fhsaEligible,
    fhsaRoom, fhsaLifetimeUsed, fhsaYearsLeft
  } = input ?? {};
  const region = provinceCode(province);
  const current = bounded(income);
  const retirement = bounded(retirementIncome);
  const horizon = bounded(years, 60);
  const growth = (1 + bounded(annualReturn, 100) / 100) ** horizon;
  const savings = toCents(bounded(budget, budgetType === 'pretax' ? current : MAX_MONEY)) / 100;
  const startingTax = taxAt(current, region);
  const taxSaving = deduction => startingTax - taxAt(Math.max(0, current - deduction), region);
  const currentRate = taxAt(Math.min(MAX_MONEY + 0.01, current + 0.01), region) - startingTax;
  const futureRate = hasOverride(retirementRate)
    ? bounded(retirementRate, 100) / 100
    : (taxAt(retirement + 0.01, region) - taxAt(retirement, region)) / 0.01;
  const withdrawalRate = Math.max(0, futureRate);
  const cashBudget = toCents(savings - (budgetType === 'pretax' ? taxSaving(savings) : 0)) / 100;
  const deadline = fhsaYearsLeft == null || fhsaYearsLeft === ''
    ? LIMITS.fhsaYears : bounded(fhsaYearsLeft, LIMITS.fhsaYears);
  const qualifyingFHSA = fhsaEligible === true && horizon <= deadline;
  const room = {
    FHSA: qualifyingFHSA ? Math.min(
      bounded(fhsaRoom, LIMITS.fhsaAnnual + LIMITS.fhsaCarry),
      LIMITS.fhsaLifetime - bounded(fhsaLifetimeUsed, LIMITS.fhsaLifetime)
    ) : 0,
    RRSP: hasOverride(rrspRoom)
      ? bounded(rrspRoom)
      : Math.min(MAX_MONEY, rrspNewRoom(priorIncome, pensionAdjustment) + bounded(rrspCarry)),
    TFSA: bounded(tfsaRoom)
  };

  function scenario(account, reinvest) {
    const deductible = account !== 'TFSA';
    const deposit = deductible && reinvest
      ? affordable(room[account], cashBudget, amount => amount - taxSaving(amount))
      : toCents(Math.min(cashBudget, room[account])) / 100;
    const refund = deductible ? taxSaving(deposit) : 0;
    const unusedCash = Math.max(0, cashBudget - deposit + (reinvest ? refund : 0));
    const registered = deposit * growth * (account === 'RRSP' ? 1 - withdrawalRate : 1);
    return {
      deposit, refund, spentRefund: reinvest ? 0 : refund,
      unusedCash, registered, endingWealth: registered + unusedCash
    };
  }

  const comparisons = {
    FHSA: qualifyingFHSA ? { reinvest: scenario('FHSA', true), spend: scenario('FHSA', false) } : null,
    RRSP: { reinvest: scenario('RRSP', true), spend: scenario('RRSP', false) },
    TFSA: scenario('TFSA', false)
  };

  const fhsa = comparisons.FHSA?.reinvest.deposit ?? 0;
  const netFHSA = fhsa - taxSaving(fhsa);
  const nextRRSPRate = (taxSaving(fhsa + 0.01) - taxSaving(fhsa)) / 0.01;
  const remaining = Math.max(0, cashBudget - netFHSA);
  const rrspRefund = amount => taxSaving(fhsa + amount) - taxSaving(fhsa);
  const rrspCost = amount => amount - rrspRefund(amount);
  const maxRRSP = affordable(room.RRSP, remaining, rrspCost);
  const tfsaCapacity = toCents(room.TFSA) / 100;
  const exhaustTFSA = affordable(maxRRSP, Math.max(0, remaining - tfsaCapacity), rrspCost);

  // Between these tax breakpoints and the TFSA room boundary, ending wealth is linear.
  const thresholds = [
    0, 16452, PERSONAL[region], ...FEDERAL.map(([upper]) => upper),
    ...PROVINCES[region].map(([upper]) => upper),
    ...(region === 'MB' ? [200000, 400000] : [])
  ];
  const candidates = [0, maxRRSP, exhaustTFSA, Math.min(maxRRSP, exhaustTFSA + 0.01)];
  for (const threshold of thresholds) {
    const toBoundary = current - fhsa - threshold;
    if (toBoundary > 0 && toBoundary < maxRRSP) {
      const floor = toCents(toBoundary) / 100;
      candidates.push(floor, Math.min(maxRRSP, floor + 0.01));
    }
  }

  let allocation;
  for (const rrsp of candidates) {
    const netRRSP = rrspCost(rrsp);
    const tfsa = toCents(Math.min(tfsaCapacity, Math.max(0, remaining - netRRSP))) / 100;
    const unusedCash = Math.max(0, remaining - netRRSP - tfsa);
    const registered = (fhsa + rrsp * (1 - withdrawalRate) + tfsa) * growth;
    const endingWealth = registered + unusedCash;
    const tolerance = 1e-12 * Math.max(1, endingWealth);
    if (!allocation || endingWealth > allocation.endingWealth + tolerance ||
        (Math.abs(endingWealth - allocation.endingWealth) <= tolerance && rrsp < allocation.RRSP)) {
      allocation = {
        FHSA: fhsa, RRSP: rrsp, TFSA: tfsa, unusedCash, endingWealth,
        netFHSA, netRRSP, refund: taxSaving(fhsa + rrsp)
      };
    }
  }

  return {
    region, room, qualifyingFHSA, cashBudget, growth, currentRate: Math.max(0, currentRate / 0.01),
    retirementRate: withdrawalRate, nextRRSPRate, comparisons, allocation
  };
}
