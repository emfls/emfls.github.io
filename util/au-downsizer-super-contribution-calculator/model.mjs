const MAX_CENTS = 10_000_000_000;
const roundRatio = (n, d) => Math.sign(n) * Math.floor((Math.abs(n) + d / 2) / d);

function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(name + ' is outside the supported range.');
  }
  return value;
}
const money = (value, name) => integer(value, 0, MAX_CENTS, name);

export function parseCents(value) {
  const match = /^([+-]?)([0-9]{1,9})(?:[.]([0-9]{1,2}))?$/.exec(String(value).trim());
  if (!match) throw new RangeError('Enter a number with up to two decimal places.');
  const cents = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return integer(match[1] === '-' && cents ? -cents : cents, -MAX_CENTS, MAX_CENTS, 'Amount');
}

export const DOWNSIZER_CAP = 30000000;
export const GENERAL_TBC = 210000000;
export const PENSION_AGE = 67;
const THRESHOLDS = Object.freeze({
  single: [[60000000,101275000],[33300000,74575000]],
  couple: [[76600000,138800000],[49900000,112100000]],
});

export function assetsTest(assets, couple, homeowner, eligible) {
  integer(assets, 0, MAX_CENTS * 2, 'Assessable assets');
  integer(eligible, 0, couple ? 2 : 1, 'Age-eligible people');
  const [full, cutoff] = THRESHOLDS[couple ? 'couple' : 'single'][Number(homeowner)];
  const maximum = couple ? 93300 * eligible : 123770 * eligible;
  const excessSteps = Math.floor(Math.max(0, assets - full) / 25000);
  // DSS applies complete A$250 steps and A$0.75 per step for the household.
  const taper = couple ? roundRatio(excessSteps * 75 * eligible, 2) : excessSteps * 75;
  const reduction = assets > cutoff ? maximum : Math.min(maximum, taper);
  return {assets, full, cutoff, reduction, payment:maximum - reduction, annualReduction:reduction * 26};
}

export function downsize({owned, days, australian, cgt, proceeds, otherAssets, beforeAssessable,
  homeowner, people}) {
  integer(owned, 0, 130, 'Ownership years');
  integer(days, 0, 3650, 'Days after settlement');
  money(proceeds, 'Sale proceeds');
  money(otherAssets, 'Other assessable assets');
  money(beforeAssessable, 'Previously assessable proceeds to move');
  if (people.length < 1 || people.length > 2) throw new RangeError('Choose one or two household members.');

  let remaining = proceeds;
  const members = people.map(({age, prior, wanted, eligiblePhase, cap, used}) => {
    integer(age, 0, 130, 'Age at contribution');
    money(wanted, 'Desired contribution');
    integer(cap, 160000000, GENERAL_TBC, 'Personal transfer balance cap');
    integer(used, -MAX_CENTS, MAX_CENTS, 'ATO transfer balance account');
    const reasons = [];
    if (age < 55) reasons.push('under age 55');
    if (owned < 10) reasons.push('owned for less than 10 years');
    if (!australian) reasons.push('dwelling is outside Australia or excluded');
    if (!cgt) reasons.push('main residence CGT condition not met');
    if (days > 90) reasons.push('outside the standard 90-day window');
    if (prior) reasons.push('previous downsizer election');
    const maximum = reasons.length ? 0 : Math.min(remaining, DOWNSIZER_CAP);
    const contribution = Math.min(wanted, maximum);
    remaining -= contribution;
    const pension = eligiblePhase ? Math.min(contribution, Math.max(0, cap - used)) : 0;
    return {age, maximum, contribution, pension, accumulation:contribution - pension,
      assessable:age >= PENSION_AGE ? contribution : pension, reasons};
  });

  const total = proceeds - remaining;
  const couple = people.length === 2;
  const eligible = members.filter(member => member.age >= PENSION_AGE).length;
  const assessable = members.reduce((sum, member) => sum + member.assessable, 0);
  const before = assetsTest(otherAssets + Math.min(total, beforeAssessable), couple, homeowner, eligible);
  const after = assetsTest(otherAssets + assessable, couple, homeowner, eligible);
  return {members, total, before, after, eligible};
}
