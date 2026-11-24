export const LIMITS = Object.freeze({ annual: 111000, split: 55000, age: 70.5 });

const RULES = {
  single: {
    filers: 1, standard: 16100, aged: 2050, cashCap: 1000, seniorThreshold: 75000,
    brackets: [0, 12400, 50400, 105700, 201775, 256225, 640600],
    medicare: [109000, 137000, 171000, 205000, 500000],
  },
  joint: {
    filers: 2, standard: 32200, aged: 1650, cashCap: 2000, seniorThreshold: 150000,
    brackets: [0, 24800, 100800, 211400, 403550, 512450, 768700],
    medicare: [218000, 274000, 342000, 410000, 750000],
  },
};
const RATES = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
const PART_B_CENTS = [0, 8120, 20290, 32460, 44630, 48700];
const PART_D_CENTS = [0, 1450, 3750, 6040, 8330, 9100];
const cents = amount => Math.round(amount * 100) / 100;
const positive = amount => Math.max(0, amount);

function rulesFor(status) {
  if (!Object.hasOwn(RULES, status)) throw new RangeError('Choose Single or Married filing jointly.');
  return RULES[status];
}

function number(value, name, min = 0, max = 1e12) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(name + ' must be a number from ' + min + ' to ' + max + '.');
  }
  return value;
}

function people(value, name, status) {
  number(value, name, 0, rulesFor(status).filers);
  if (!Number.isInteger(value)) throw new RangeError(name + ' must be a whole number.');
  return value;
}

export function irmaa(magi, status, partB, partD) {
  const thresholds = rulesFor(status).medicare;
  people(partB, 'Part B enrollment', status);
  people(partD, 'Part D enrollment', status);
  const tierIndex = thresholds.filter((cutoff, i) =>
    i === thresholds.length - 1 ? magi >= cutoff : magi > cutoff).length;
  const monthlyCents = PART_B_CENTS[tierIndex] * partB + PART_D_CENTS[tierIndex] * partD;
  return { tier: tierIndex + 1, monthly: monthlyCents / 100, annual: monthlyCents * 12 / 100 };
}

export function federalTax(taxable, status) {
  const brackets = rulesFor(status).brackets;
  return cents(brackets.reduce((tax, lower, i) => {
    const upper = brackets[i + 1] ?? Infinity;
    return tax + positive(Math.min(taxable, upper) - lower) * RATES[i];
  }, 0));
}

export function charityDeduction(gift, agi, status, method) {
  const { cashCap } = rulesFor(status);
  const contributionBase = positive(agi);
  const allowedBeforeFloor = Math.min(gift, contributionBase * 0.60);
  if (method === 'standard') return { amount: cents(Math.min(allowedBeforeFloor, cashCap)), haircut: 0 };
  const haircut = Math.min(allowedBeforeFloor, cents(contributionBase * 0.005));
  return { amount: cents(allowedBeforeFloor - haircut), haircut };
}

function ownerPlan(donor) {
  const age = number(donor.age, 'Age at transfer', 0, 130);
  const rmd = cents(number(donor.rmd, 'Annual IRA RMD'));
  const alreadyTaken = cents(number(donor.alreadyTaken, 'IRA distributions already taken'));
  const gift = cents(number(donor.gift, 'Direct charity gift'));
  const splitRequest = cents(number(donor.split, 'Split-interest funding'));
  const offset = cents(number(donor.offset, 'Unused deductible IRA contribution offset'));
  const cap = age >= LIMITS.age ? LIMITS.annual : 0;

  const split = Math.min(splitRequest, cap, donor.splitUsed ? 0 : LIMITS.split);
  const direct = Math.min(gift, cap - split);
  const transferred = direct + split;
  const taxableTransfer = Math.min(transferred, offset);
  const cashFallback = cents(gift + splitRequest - transferred);
  const outstanding = positive(rmd - alreadyTaken);
  const remainingRmd = cents(positive(outstanding - transferred));
  return {
    cap, split, direct, transferred: cents(transferred), taxableTransfer, offset,
    excluded: cents(transferred - taxableTransfer),
    taxableDirect: Math.min(direct, taxableTransfer),
    remainingRmd, rmdCovered: cents(Math.min(outstanding, transferred)),
    cashDistribution: Math.max(rmd, alreadyTaken),
    taxableQcdDistribution: cents(alreadyTaken + remainingRmd + taxableTransfer),
    gift: cents(gift + splitRequest), cashFallback,
  };
}

function taxScenario(agi, charity, status, method, seniorCount, otherItemized) {
  const rules = rulesFor(status);
  const senior = cents(seniorCount * positive(6000 - 0.06 * positive(agi - rules.seniorThreshold)));
  const deduction = method === 'standard' ? rules.standard + seniorCount * rules.aged : otherItemized;
  const topThreshold = rules.brackets.at(-1);
  const itemized = method === 'itemized' ? deduction + charity : 0;
  // IRC section 68 reduces the portion of itemized deductions exposed to the 37% bracket.
  const section68 = Math.min(itemized, positive(agi - senior - topThreshold)) * 2 / 37;
  const taxable = cents(positive(agi - senior - deduction - charity + section68));
  return { senior, taxable, section68: cents(section68), tax: federalTax(taxable, status) };
}

export function calculate(input) {
  const { status, method, donors, seniorCount, partB, partD } = input;
  const { filers } = rulesFor(status);
  if (!['standard', 'itemized'].includes(method)) throw new RangeError('Choose a deduction method.');
  if (!Array.isArray(donors) || donors.length !== filers) {
    throw new RangeError('Enter the IRA details for each filer.');
  }
  people(seniorCount, 'Eligible seniors', status);
  const otherAgi = cents(number(input.otherAgi, 'Other AGI', -1e12));
  const exemptInterest = cents(number(input.exemptInterest, 'Tax-exempt interest'));
  const otherItemized = cents(number(input.otherItemized, 'Other itemized deductions'));
  const plans = donors.map(ownerPlan);
  const sum = key => cents(plans.reduce((total, owner) => total + owner[key], 0));
  const cashFallback = sum('cashFallback');

  function scenario(distributions, gift) {
    const agi = cents(otherAgi + distributions);
    const magi = cents(agi + exemptInterest);
    const charity = charityDeduction(gift, agi, status, method);
    const tax = taxScenario(agi, charity.amount, status, method, seniorCount, otherItemized);
    const withoutGift = taxScenario(agi, 0, status, method, seniorCount, otherItemized);
    return {
      agi, magi, distributions, charity: charity.amount, haircut: charity.haircut,
      ...tax, charityTaxBenefit: cents(withoutGift.tax - tax.tax),
      irmaa: irmaa(magi, status, partB, partD),
    };
  }

  const cash = scenario(sum('cashDistribution'), sum('gift'));
  // The model counts offset-taxable direct gifts only for itemizers.
  const qcd = scenario(sum('taxableQcdDistribution'),
    cents(cashFallback + (method === 'itemized' ? sum('taxableDirect') : 0)));
  const federalSaved = cents(cash.tax - qcd.tax);
  const irmaaSaved = cents(cash.irmaa.annual - qcd.irmaa.annual);
  return {
    cash, qcd, donors: plans, cashFallback, federalSaved, irmaaSaved,
    standardDeduction: RULES[status].standard + seniorCount * RULES[status].aged,
    qcdExcluded: sum('excluded'), taxableTransfer: sum('taxableTransfer'),
    totalSaved: cents(federalSaved + irmaaSaved),
    remainingRmd: sum('remainingRmd'), rmdCovered: sum('rmdCovered'),
    haircutAvoided: cents(positive(cash.haircut - qcd.haircut)),
  };
}
