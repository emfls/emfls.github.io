export const HEAS_RATE = 3.95;
export const FORTNIGHTS = 26;
export const PENSION_RATES = Object.freeze({
  official: Object.freeze({ single: 1237.70, couple: 1866 }),
  illustrative: Object.freeze({ single: 1178.70, couple: 1777 }),
});

// Index 0 represents age 55 or younger. The final entry covers ages 90+.
export const AGE_COMPONENTS = Object.freeze([
  1710, 1780, 1850, 1920, 2000, 2080, 2160, 2250, 2340, 2430,
  2530, 2630, 2740, 2850, 2960, 3080, 3200, 3330, 3460, 3600,
  3750, 3900, 4050, 4210, 4380, 4560, 4740, 4930, 5130, 5330,
  5550, 5770, 6000, 6240, 6490, 6750,
]);

const CHECKPOINTS = [10, 15, 20];
const cents = value => {
  const rounded = Math.round(value * 100 + 1e-7) / 100;
  return rounded === 0 ? 0 : rounded;
};
const floorCents = value => Math.floor(value * 100 + 1e-7) / 100;

export function ageComponent(age) {
  if (!Number.isInteger(age) || age < 0) throw new RangeError('Enter age in whole years.');
  return AGE_COMPONENTS[Math.min(90, Math.max(55, age)) - 55];
}

export function loanLimit(age, netProperty, reserve = 0, participants = 1) {
  const securedShare = Math.max(0, netProperty - reserve) / participants;
  return ageComponent(age) * Math.floor(securedShare / 10000) * participants;
}

export function paymentLimits(maxPension, pension, activeAdvances = 0, participants = 1) {
  const pensionShare = maxPension / participants;
  const cap = floorCents(pensionShare * 1.5) * participants;
  const topUp = cents(Math.max(0, cap - pension));
  const advanceCap = floorCents(pensionShare * FORTNIGHTS * 0.5) * participants;
  const reduction = Math.min(activeAdvances, advanceCap) / FORTNIGHTS;
  const afterAdvance = cents(Math.max(0, cap - reduction - pension));
  return { cap, annualCap: cents(cap * FORTNIGHTS), topUp, advanceCap, afterAdvance };
}

export function settlement(balance, property, liens, protectedLoan = true) {
  const netProperty = cents(property - liens);
  const security = Math.max(0, netProperty);
  const shortfall = cents(Math.max(0, balance - security));
  const repayment = protectedLoan ? Math.min(balance, security) : balance;
  return { netProperty, shortfall, repayment, equity: cents(netProperty - repayment) };
}

const INPUT_RANGES = {
  age: ['Applicant age', 18, 120, true],
  partnerAge: ['Partner age', 18, 120, true],
  maxPension: ['Maximum fortnightly pension', 1, 10000],
  pension: ['Current fortnightly pension', 0, 10000],
  property: ['Property value', 1, 100000000],
  liens: ['Other secured debt', 0, 100000000],
  reserve: ['Equity excluded from HEAS security', 0, 100000000],
  draw: ['Desired fortnightly draw', 0, 15000],
  advance1: ['First advance', 0, 130000],
  advance2: ['Second advance', 0, 130000],
  secondFortnight: ['Second advance fortnight', 2, 26, true],
  commercialRate: ['Commercial interest rate', 0, 50],
  propertyGrowth: ['Annual property growth', -50, 25],
};

function validate(inputs) {
  if (!['single', 'couple'].includes(inputs.household)) throw new RangeError('Choose a household type.');
  for (const [key, [label, min, max, whole]] of Object.entries(INPUT_RANGES)) {
    if (key === 'partnerAge' && inputs.household === 'single') continue;
    if (key === 'secondFortnight' && inputs.advance2 === 0) continue;
    const value = inputs[key];
    if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
      const unit = whole ? ' as a whole number' : '';
      throw new RangeError(`Enter ${label.toLowerCase()} between ${min.toLocaleString('en-AU')} and ${max.toLocaleString('en-AU')}${unit}.`);
    }
    if (!whole && cents(value) !== value) {
      throw new RangeError(`Enter ${label.toLowerCase()} with at most two decimal places.`);
    }
  }
  const oldestAge = inputs.household === 'single' ? inputs.age : Math.max(inputs.age, inputs.partnerAge);
  if (oldestAge < 67) throw new RangeError('At least one partner, or a single applicant, must be aged 67 or older.');
}

export function project(inputs) {
  validate(inputs);
  const {
    household, age, partnerAge, maxPension, pension, property, liens, reserve, draw,
    advance1, advance2, secondFortnight, commercialRate, propertyGrowth,
    heasProtection = true, commercialProtection = true,
  } = inputs;
  const participants = household === 'couple' ? 2 : 1;
  const assessedAge = participants === 2 ? Math.min(age, partnerAge) : age;
  const limits = paymentLimits(maxPension, pension, 0, participants);
  const startLimit = loanLimit(assessedAge, property - liens, reserve, participants);
  const heasFactor = HEAS_RATE / 100 / FORTNIGHTS;
  const commercialFactor = commercialRate / 100 / FORTNIGHTS;
  const growth = 1 + propertyGrowth / 100;
  const advances = [];
  const timeline = [];
  const snapshots = [];

  let heasBalance = 0;
  let commercialBalance = 0;
  let drawn = 0;
  let stopped = false;
  let stoppedFortnight = null;

  for (let fortnight = 1; fortnight <= CHECKPOINTS.at(-1) * FORTNIGHTS; fortnight++) {
    const elapsedYears = Math.floor((fortnight - 1) / FORTNIGHTS);
    const valuation = cents(property * growth ** elapsedYears);
    const limit = loanLimit(assessedAge + elapsedYears, valuation - liens, reserve, participants);
    const activeTotal = advances.reduce((total, entry) => (
      fortnight - entry.fortnight < FORTNIGHTS ? total + entry.amount : total
    ), 0);

    const requestedAdvance = fortnight === 1 ? advance1 : fortnight === secondFortnight ? advance2 : 0;
    const headroom = stopped ? 0 : cents(Math.max(0, limit - heasBalance));
    const advance = cents(Math.min(requestedAdvance, limits.advanceCap - activeTotal, headroom));
    if (advance > 0) advances.push({ fortnight, amount: advance });

    const { afterAdvance: paymentCap } = paymentLimits(
      maxPension, pension, activeTotal + advance, participants,
    );
    const payment = cents(Math.min(draw, paymentCap, headroom - advance));
    const cash = cents(advance + payment);
    drawn = cents(drawn + cash);
    heasBalance = cents((heasBalance + cash) * (1 + heasFactor));
    commercialBalance = cents((commercialBalance + cash) * (1 + commercialFactor));

    if (!stopped && heasBalance >= limit) {
      stopped = true;
      stoppedFortnight = fortnight;
    }
    timeline.push({ fortnight, loanLimit: limit, advance, draw: payment, paymentCap, heasBalance, commercialBalance });

    const year = fortnight / FORTNIGHTS;
    if (CHECKPOINTS.includes(year)) {
      const projectedProperty = cents(property * growth ** year);
      const heasSettlement = settlement(heasBalance, projectedProperty, liens, heasProtection);
      const commercialSettlement = settlement(commercialBalance, projectedProperty, liens, commercialProtection);
      snapshots.push({
        year, property: projectedProperty, drawn, heasBalance, commercialBalance,
        heasInterest: cents(heasBalance - drawn), commercialInterest: cents(commercialBalance - drawn),
        heasSettlement, commercialSettlement,
        equityPreserved: cents(heasSettlement.equity - commercialSettlement.equity),
      });
    }
  }

  return {
    limits, assessedAge, factor: ageComponent(assessedAge), startLimit, stoppedFortnight,
    firstDraw: timeline[0].draw, firstPaymentCap: timeline[0].paymentCap,
    firstCombined: cents(pension + timeline[0].draw),
    firstAdvance: timeline[0].advance,
    secondAdvance: advance2 > 0 ? timeline[secondFortnight - 1].advance : 0,
    timeline, snapshots,
  };
}
