export const LIMITS = Object.freeze({
  minimumAge: 55,
  ownershipYears: 10,
  deadlineDays: 90,
  individual: 300_000,
  concessional: 32_500,
  nonConcessional: 130_000,
  bringForward: 390_000,
  generalTransferCap: 2_100_000,
  pensionAge: 67,
  accumulationTax: 0.15,
});

const DAY = 86_400_000;
const CENTS = 100;
const FORTNIGHTS = 26;
const PENSION = {
  single: { homeowner: [333_000, 745_750], nonHomeowner: [600_000, 1_012_750], max: 1237.70 },
  couple: { homeowner: [499_000, 1_121_000], nonHomeowner: [766_000, 1_388_000], max: 933 },
};

function readNumber(value, label, min = 0, max = 1_000_000_000) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter a valid ${label} between ${min} and ${max}.`);
  }
  return value;
}

function cents(value) {
  return Math.round(value * CENTS);
}

function dollars(value) {
  return value / CENTS;
}

function roundMoney(value) {
  return dollars(cents(value));
}

function dateMillis(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const millis = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(millis) && isoDate(millis) === value ? millis : NaN;
}

function isoDate(millis) {
  return new Date(millis).toISOString().slice(0, 10);
}

function checkMember(member, commonGates, settlement, standardDeadline) {
  const age = readNumber(member.age, 'age', 0, Number.MAX_SAFE_INTEGER);
  if (!Number.isInteger(age)) throw new RangeError('Enter age in whole years.');
  const paymentDate = dateMillis(member.date);
  const extensionDate = member.extension ? dateMillis(member.extension) : standardDeadline;
  if (!Number.isFinite(extensionDate) || extensionDate < standardDeadline) {
    throw new RangeError('Enter an approved extension date on or after the standard deadline.');
  }

  const daysFromSettlement = (paymentDate - settlement) / DAY;
  const gates = {
    age: age >= LIMITS.minimumAge,
    ...commonGates,
    timing: paymentDate >= settlement && paymentDate <= extensionDate,
    form: member.formReady === true,
    priorUse: member.priorOtherSale === false,
  };
  const eligible = Object.values(gates).every(Boolean);
  const prior = cents(readNumber(member.priorSameSale, 'prior downsizer amount', 0, LIMITS.individual));
  const personalCap = cents(readNumber(member.personalCap, 'personal transfer balance cap', 0, LIMITS.generalTransferCap));
  const transferBalance = cents(readNumber(member.transferBalance, 'transfer balance account value', -1_000_000_000));
  const headroom = Math.max(0, personalCap - transferBalance);

  return {
    age, daysFromSettlement: Number.isFinite(daysFromSettlement) ? daysFromSettlement : null,
    gates, eligible, prior, headroom, retirementPhase: member.retirementPhase === true,
    limit: eligible ? cents(LIMITS.individual) - prior : 0,
  };
}

function allocatePhase(member, amount) {
  const retirement = member.retirementPhase ? Math.min(amount, member.headroom) : 0;
  return {
    eligible: member.eligible,
    gates: member.gates,
    daysFromSettlement: member.daysFromSettlement,
    headroom: dollars(member.headroom),
    amount: dollars(amount),
    retirementAmount: dollars(retirement),
    accumulationAmount: dollars(amount - retirement),
    assessable: dollars(member.age >= LIMITS.pensionAge ? amount : retirement),
  };
}

function estimatePension(input, a, b, checkA, checkB) {
  const rules = PENSION[input.household];
  const requested = readNumber(input.pensionRecipients, 'number of Age Pension recipients', 0, 2);
  if (!Number.isInteger(requested)) throw new RangeError('Enter a whole number of Age Pension recipients.');
  const ageQualified = [checkA, checkB].filter(member => member && member.age >= LIMITS.pensionAge).length;
  const recipients = Math.min(requested, ageQualified);
  if (recipients === 0) return null;

  const baseline = roundMoney(readNumber(input.otherAssets, 'baseline assessable assets'));
  const [threshold, cutoff] = rules[input.homeowner ? 'homeowner' : 'nonHomeowner'];
  const assessableAdded = roundMoney(a.assessable + (b?.assessable ?? 0));

  function payment(assets) {
    if (assets > cutoff) return 0;
    const excess = Math.max(0, assets - threshold);
    // A partnered member is assessed on half the couple's excess.
    const step = checkB ? 500 : 250;
    const reductionPerRecipient = Math.floor(excess / step) * 0.75;
    return Math.max(0, rules.max - reductionPerRecipient) * recipients;
  }

  const before = roundMoney(payment(baseline));
  const after = roundMoney(payment(roundMoney(baseline + assessableAdded)));
  const fortnightlyLoss = roundMoney(before - after);
  return { threshold, assessableAdded, recipients, before, after, fortnightlyLoss,
    annualLoss: roundMoney(fortnightlyLoss * FORTNIGHTS) };
}

export function calculate(input) {
  const { household } = input;
  if (household !== 'single' && household !== 'couple') throw new RangeError('Select single or couple.');
  const proceeds = cents(readNumber(input.proceeds, 'sale proceeds'));
  const settlement = dateMillis(input.settlement);
  const contract = dateMillis(input.contract);
  if (!Number.isFinite(settlement) || !Number.isFinite(contract) || contract > settlement) {
    throw new RangeError('Enter a valid sale contract date on or before settlement.');
  }

  const standardDeadline = settlement + LIMITS.deadlineDays * DAY;
  const commonGates = {
    ownership: readNumber(input.yearsOwned, 'ownership period', 0, 130) >= LIMITS.ownershipYears,
    dwelling: input.qualifyingHome === true,
    contract: input.contract >= '2018-07-01',
  };
  const checkA = checkMember(input.a, commonGates, settlement, standardDeadline);
  const checkB = household === 'couple' ? checkMember(input.b, commonGates, settlement, standardDeadline) : null;
  const prior = checkA.prior + (checkB?.prior ?? 0);
  if (prior > proceeds) throw new RangeError('Prior downsizer contributions cannot exceed sale proceeds.');
  const available = proceeds - prior;
  const limitB = checkB?.limit ?? 0;
  const total = Math.min(available, checkA.limit + limitB);
  const shareA = checkB ? readNumber(input.shareA, 'Member A share (%)', 0, 100) / 100 : 1;
  const amountA = Math.min(checkA.limit, Math.max(total - limitB, Math.round(total * shareA)));
  const a = allocatePhase(checkA, amountA);
  const b = checkB ? allocatePhase(checkB, total - amountA) : null;

  const retirementAmount = roundMoney(a.retirementAmount + (b?.retirementAmount ?? 0));
  const accumulationAmount = dollars(total - cents(retirementAmount));
  const returnRate = readNumber(input.grossReturn, 'annual return (%)', -100, 100) / 100;
  const outsideRate = readNumber(input.outsideTax, 'outside marginal tax rate (%)', 0, 100) / 100;
  const gross = dollars(total) * returnRate;
  const afterSuperTax = gross - Math.max(0, accumulationAmount * returnRate) * LIMITS.accumulationTax;
  const afterOutsideTax = gross - Math.max(0, gross) * outsideRate;

  return {
    a, b, total: dollars(total), remainingProceeds: dollars(available - total),
    deadline: isoDate(standardDeadline), retirementAmount, accumulationAmount, contributionsTax: 0,
    pension: estimatePension(input, a, b, checkA, checkB),
    returns: {
      gross: roundMoney(gross), afterSuperTax: roundMoney(afterSuperTax),
      afterOutsideTax: roundMoney(afterOutsideTax), taxBenefit: roundMoney(afterSuperTax - afterOutsideTax),
    },
  };
}
