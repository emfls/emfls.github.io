export const STATUTORY_FEES = Object.freeze({
  levy: 259,
  firstLevy: 518,
  corporate: 70,
  standard: 342,
  individual: 0,
});

export const PRESETS = Object.freeze({
  industry: Object.freeze({ admin: 0.15, investment: 0.55 }),
  retail: Object.freeze({ admin: 0.45, investment: 0.90 }),
});

export const PROJECTION_YEARS = 20;

export const DEFAULTS = Object.freeze({
  balance: 500000,
  members: 2,
  trustee: 'corporate',
  accounting: 2200,
  actuarial: 0,
  setup: 1800,
  mer: 0.08,
  fixedWeekly: 1.50,
  ...PRESETS.industry,
  adminCap: null,
  gross: 7.5,
});

function numberInRange(name, value, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`);
  }
}

function validate(options) {
  for (const key of ['balance', 'accounting', 'actuarial', 'setup', 'fixedWeekly']) {
    numberInRange(key, options[key], 0, 1e9);
  }
  for (const key of ['mer', 'admin', 'investment']) {
    numberInRange(key, options[key], 0, 100);
  }
  if (options.adminCap !== null) numberInRange('adminCap', options.adminCap, 0, 1e9);
  numberInRange('members', options.members, 1, 6);
  if (!Number.isInteger(options.members)) throw new RangeError('Use a whole number of members.');
  numberInRange('gross', options.gross, -100, 100);
  if (!['corporate', 'standard', 'individual'].includes(options.trustee)) {
    throw new RangeError('Select a trustee structure.');
  }
}

function feeTerms(options) {
  const { members, trustee, accounting, actuarial, setup, mer, fixedWeekly, admin, investment, adminCap } = options;
  return {
    smsfFixed: accounting + actuarial + STATUTORY_FEES.levy + STATUTORY_FEES[trustee],
    firstExtra: setup + STATUTORY_FEES.firstLevy - STATUTORY_FEES.levy,
    apraFixed: fixedWeekly * 52 * members,
    adminLimit: adminCap === null || admin === 0 ? Infinity : adminCap * members,
    merRate: mer / 100,
    adminRate: admin / 100,
    investmentRate: investment / 100,
  };
}

function smsfFee(terms, balance, extraFixed = 0) {
  return terms.smsfFixed + extraFixed + balance * terms.merRate;
}

function apraFee(terms, balance) {
  return terms.apraFixed + balance * terms.investmentRate + Math.min(balance * terms.adminRate, terms.adminLimit);
}

export function annualFees(options, balance = options.balance, firstYear = false) {
  validate(options);
  if (!Number.isFinite(balance) || balance < 0) throw new RangeError('Use a finite nonnegative balance.');
  const terms = feeTerms(options);
  return {
    smsf: smsfFee(terms, balance, firstYear ? terms.firstExtra : 0),
    apra: apraFee(terms, balance),
  };
}

// Solve APRA minus SMSF separately before and after the pooled admin cap.
// A positive difference means SMSF fees are lower on that open interval.
function solveBreakeven(terms, extraFixed) {
  const { adminRate, adminLimit, investmentRate, merRate, apraFixed, smsfFixed } = terms;
  const knee = adminLimit === Infinity ? Infinity : adminLimit / adminRate;
  const baseIntercept = apraFixed - (smsfFixed + extraFixed);
  const baseSlope = investmentRate - merRate;
  const segments = [];
  if (knee > 0) segments.push([0, knee, baseIntercept, baseSlope + adminRate]);
  if (knee < Infinity) segments.push([knee, Infinity, baseIntercept + adminLimit, baseSlope]);

  const points = [];
  const ranges = [];
  function addRange(from, to, relation) {
    if (from === to) return;
    const last = ranges.at(-1);
    if (last?.relation === relation && !points.includes(from)) {
      last.to = to;
    } else {
      ranges.push({ from, to, relation });
    }
  }

  for (const [from, to, intercept, slope] of segments) {
    // Compare within floating-point precision at the start of each segment.
    const scale = Math.max(Math.abs(intercept), Math.abs(slope * from), 1);
    const value = intercept + slope * from;
    const startSign = Math.abs(value) <= Number.EPSILON * 8 * scale ? 0 : Math.sign(value);
    const slopeSign = Math.abs(slope) <= Number.EPSILON * Math.max(merRate, investmentRate, adminRate) * 8
      ? 0 : Math.sign(slope);
    const relation = sign => sign > 0 ? 'smsf' : sign < 0 ? 'apra' : 'tie';

    if (!startSign && (slopeSign || from > 0) && !points.includes(from)) points.push(from);
    const root = slopeSign && startSign ? -intercept / slope : from;
    const boundaryTolerance = Number.isFinite(to) ? Number.EPSILON * 8 * to : 0;
    if (root > from && root < to - boundaryTolerance) {
      addRange(from, root, relation(startSign));
      points.push(root);
      addRange(root, to, relation(slopeSign));
    } else {
      addRange(from, to, relation(startSign || slopeSign));
    }
  }
  return { points, ranges, capBalance: Number.isFinite(knee) ? knee : null };
}

export function feeBreakeven(options, extraFixed = 0) {
  validate(options);
  numberInRange('extraFixed', extraFixed, 0, Number.MAX_SAFE_INTEGER);
  return solveBreakeven(feeTerms(options), extraFixed);
}

export function projectWealth(options, years = PROJECTION_YEARS) {
  validate(options);
  numberInRange('years', years, 1, 100);
  if (!Number.isInteger(years)) throw new RangeError('Use a whole number of years.');

  const terms = feeTerms(options);
  const growth = 1 + options.gross / 100;
  let smsf = options.balance;
  let apra = options.balance;
  for (let year = 1; year <= years; year++) {
    smsf = Math.max(0, smsf * growth - smsfFee(terms, smsf, year === 1 ? terms.firstExtra : 0));
    apra = Math.max(0, apra * growth - apraFee(terms, apra));
  }
  return { years, smsf, apra, gap: smsf - apra };
}

export function compare(options) {
  validate(options);
  const { balance, setup } = options;
  const terms = feeTerms(options);
  const annualisedSetup = setup / PROJECTION_YEARS;
  const apra = apraFee(terms, balance);

  function snapshot(extraFixed) {
    const smsf = smsfFee(terms, balance, extraFixed);
    const savings = apra - smsf;
    return {
      smsf,
      apra,
      savings,
      savingsRate: balance === 0 ? null : savings / balance * 100,
    };
  }

  return {
    ongoing: snapshot(0),
    first: snapshot(terms.firstExtra),
    annualised: snapshot(annualisedSetup),
    breakeven: solveBreakeven(terms, 0),
    firstBreakeven: solveBreakeven(terms, terms.firstExtra),
    annualisedBreakeven: solveBreakeven(terms, annualisedSetup),
    wealth: projectWealth(options),
    pooling: Array.from({ length: 6 }, (_, index) => {
      const members = index + 1;
      const pooled = feeTerms({ ...options, members });
      return {
        members,
        perMemberBalance: balance / members,
        breakeven: solveBreakeven(pooled, 0),
        savings: apraFee(pooled, balance) - smsfFee(pooled, balance),
      };
    }),
  };
}
