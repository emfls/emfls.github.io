export const MAX_SPLIT = 50;
export const OAS_THRESHOLD = 95_323;
const OAS_RATE = 0.15;
const FEDERAL_PENSION_LIMIT = 2_000;
const FEDERAL_RATE = 0.14;
const FEDERAL_BRACKETS = [
  [58_523, FEDERAL_RATE], [117_045, 0.205], [181_440, 0.26],
  [258_482, 0.29], [Infinity, 0.33],
];

// Annual tax brackets, not payroll withholding rates. See the sources in index.html.
const PROVINCES = {
  ON: {
    basic: 12_989, age: 6_342, ageThreshold: 47_210, pension: 1_796,
    brackets: [[53_891, 0.0505], [107_785, 0.0915], [150_000, 0.1116], [220_000, 0.1216], [Infinity, 0.1316]],
  },
  BC: {
    basic: 13_216, age: 5_927, ageThreshold: 44_119, pension: 1_000,
    brackets: [[50_363, 0.056], [100_728, 0.077], [115_648, 0.105], [140_430, 0.1229],
      [190_405, 0.147], [265_545, 0.168], [Infinity, 0.205]],
  },
  AB: {
    basic: 22_769, age: 6_345, ageThreshold: 47_234, pension: 1_753,
    brackets: [[61_200, 0.08], [154_259, 0.10], [185_111, 0.12], [246_813, 0.13],
      [370_220, 0.14], [Infinity, 0.15]],
  },
  QC: {
    basic: 18_952,
    brackets: [[54_345, 0.14], [108_680, 0.19], [132_245, 0.24], [Infinity, 0.2575]],
  },
};
const positive = value => Math.max(0, value);

function progressiveTax(income, brackets) {
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of brackets) {
    tax += (Math.min(income, upper) - lower) * rate;
    if (income <= upper) break;
    lower = upper;
  }
  return tax;
}

export function federalBasicAmount(income) {
  const phaseout = Math.min(1, positive(income - 181_440) / (258_482 - 181_440));
  return 16_452 - (16_452 - 14_829) * phaseout;
}

function ageAmount(age, income, maximum, threshold) {
  return age >= 65 ? positive(maximum - 0.15 * positive(income - threshold)) : 0;
}

export function federalAgeAmount(age, income) {
  return ageAmount(age, income, 9_208, 46_432);
}

export function estimateOas(age) {
  if (age < 65) return 0;
  return age < 75 ? 8_900 : 9_790;
}

export function oasRecovery(netBeforeRecovery, grossOas) {
  return Math.min(grossOas, OAS_RATE * positive(netBeforeRecovery - OAS_THRESHOLD));
}

export function eligiblePension({ age, db, rrif, survivorRrif = 0 }) {
  return db + (age >= 65 ? rrif : survivorRrif);
}

export function ontarioHealthPremium(income) {
  return Math.min(300, 0.06 * positive(income - 20_000))
    + Math.min(150, 0.06 * positive(income - 36_000))
    + Math.min(150, 0.25 * positive(income - 48_000))
    + Math.min(150, 0.25 * positive(income - 72_000))
    + Math.min(150, 0.25 * positive(income - 200_000));
}

function provincialTax(province, person, pensionIncome) {
  const rule = PROVINCES[province];
  const rate = rule.brackets[0][1];
  const income = person.taxableIncome;
  const credits = rule.basic + ageAmount(person.age, income, rule.age, rule.ageThreshold)
    + Math.min(pensionIncome, rule.pension);
  const basicTax = positive(progressiveTax(income, rule.brackets) - rate * credits);
  if (province === 'ON') {
    const surtax = 0.20 * positive(basicTax - 5_818) + 0.36 * positive(basicTax - 7_446);
    const tax = basicTax + surtax;
    return positive(tax - positive(600 - tax)) + ontarioHealthPremium(income);
  }
  if (province === 'BC') {
    return positive(basicTax - positive(690 - 0.0356 * positive(income - 25_570)));
  }
  return basicTax;
}

function federalTax(age, income, pensionAmount, province) {
  const credits = federalBasicAmount(income) + federalAgeAmount(age, income) + pensionAmount;
  const basicTax = positive(progressiveTax(income, FEDERAL_BRACKETS) - FEDERAL_RATE * credits);
  return province === 'QC' ? basicTax * 0.835 : basicTax;
}

function individual(person, netBeforeRecovery, pensionIncome, province) {
  const recovery = oasRecovery(netBeforeRecovery, person.oas);
  // Line 23500 is deducted when computing net and taxable income. It is paid separately.
  const taxableIncome = netBeforeRecovery - recovery;
  const pensionAmount = Math.min(pensionIncome, FEDERAL_PENSION_LIMIT);
  return {
    age: person.age,
    netBeforeRecovery,
    taxableIncome,
    oasRecovery: recovery,
    federalPensionAmount: pensionAmount,
    federalAgeAmount: federalAgeAmount(person.age, taxableIncome),
    federalTax: federalTax(person.age, taxableIncome, pensionAmount, province),
  };
}

function quebecHouseholdTax(from, to, fromIncome, toIncome, remainingPension, receivedPension) {
  const rule = PROVINCES.QC;
  const basicTax = income => positive(progressiveTax(income, rule.brackets) - 0.14 * rule.basic);
  const ageBase = (Number(from.age >= 65) + Number(to.age >= 65)) * 3_986;
  const incomeBase = income => Math.min(3_541, 1.25 * income);
  const pensionBase = incomeBase(remainingPension) + incomeBase(receivedPension);
  const phaseout = 0.1875 * positive(fromIncome + toIncome - 42_955);
  const payable = basicTax(fromIncome) + basicTax(toIncome);
  return {
    withPension: positive(payable - 0.14 * positive(ageBase + pensionBase - phaseout)),
    withoutPension: positive(payable - 0.14 * positive(ageBase - phaseout)),
  };
}

function validateInputs({ province, transferor, recipient }) {
  if (!Object.hasOwn(PROVINCES, province)) throw new RangeError('Choose a supported province.');
  for (const person of [transferor, recipient]) {
    if (!Number.isInteger(person.age) || person.age < 18 || person.age > 120) {
      throw new RangeError('Enter each age at year-end as a whole number from 18 to 120.');
    }
    for (const value of [person.other, person.oas, person.db ?? 0, person.rrif ?? 0, person.survivorRrif ?? 0]) {
      if (!Number.isFinite(value) || value < 0 || value > 100_000_000) {
        throw new RangeError('Enter income amounts from $0 to $100 million.');
      }
    }
    if (person.age < 65 && person.oas > 0) throw new RangeError('OAS starts at age 65.');
  }
  if (!Number.isFinite(transferor.db) || !Number.isFinite(transferor.rrif)) {
    throw new RangeError('Enter the DB and RRIF/LIF amounts.');
  }
  if ((transferor.survivorRrif ?? 0) > transferor.rrif) {
    throw new RangeError('Survivor RRIF/LIF cannot exceed total RRIF/LIF withdrawals.');
  }
}

function validatePercent(pct) {
  if (!Number.isFinite(pct) || pct < 0 || pct > MAX_SPLIT) {
    throw new RangeError('Enter a split percentage from 0 to 50.');
  }
}

function calculate({ province, transferor, recipient }, splitPct, eligible) {
  const eligibleCents = Math.round(eligible * 100);
  const transfer = Math.min(Math.round(eligibleCents * splitPct / 100), Math.floor(eligibleCents / 2)) / 100;
  const fromGross = transferor.db + transferor.rrif + transferor.other + transferor.oas;
  const toGross = recipient.other + recipient.oas;
  const fromPension = positive(eligible - transfer);
  // T1032 Step 4, Note 1: for an under-65 recipient, recalculate the eligible
  // maximum without the age-restricted streams (survivor payments are exempt).
  const anyAgePension = transferor.db + (transferor.survivorRrif ?? 0);
  const toPension = recipient.age >= 65 ? transfer : Math.min(transfer, anyAgePension / 2);
  const from = individual(transferor, fromGross - transfer, fromPension, province);
  const to = individual(recipient, toGross + transfer, toPension, province);
  const recovery = from.oasRecovery + to.oasRecovery;

  let quebecTransfer = null;
  let provincial;
  let provincialWithoutPension;
  if (province === 'QC') {
    // Model one common percentage for T1032 and Schedule Q when QC permits a split.
    quebecTransfer = transferor.age >= 65 ? transfer : 0;
    const totalPension = transferor.db + transferor.rrif;
    const qc = quebecHouseholdTax(from, to,
      fromGross - quebecTransfer - from.oasRecovery,
      toGross + quebecTransfer - to.oasRecovery,
      totalPension - quebecTransfer, quebecTransfer);
    provincial = qc.withPension;
    provincialWithoutPension = qc.withoutPension;
  } else {
    from.provincialTax = provincialTax(province, from, fromPension);
    to.provincialTax = provincialTax(province, to, toPension);
    provincial = from.provincialTax + to.provincialTax;
    provincialWithoutPension = provincialTax(province, from, 0) + provincialTax(province, to, 0);
  }

  const incomeTax = from.federalTax + to.federalTax + provincial;
  const taxWithoutPension = provincialWithoutPension
    + federalTax(from.age, from.taxableIncome, 0, province)
    + federalTax(to.age, to.taxableIncome, 0, province);
  return {
    splitPct, transfer, quebecTransfer, transferor: from, recipient: to,
    federalTax: from.federalTax + to.federalTax, provincialTax: provincial,
    incomeTax, taxWithoutPension, pensionCredit: taxWithoutPension - incomeTax,
    oasRecovery: recovery, total: incomeTax + recovery,
  };
}

export function evaluateSplit(inputs, splitPct) {
  validateInputs(inputs);
  validatePercent(splitPct);
  const eligible = eligiblePension(inputs.transferor);
  return calculate(inputs, eligible > 0 ? splitPct : 0, eligible);
}

export function optimizeSplit(inputs, manualPct = null) {
  validateInputs(inputs);
  if (manualPct !== null) validatePercent(manualPct);
  const eligible = eligiblePension(inputs.transferor);
  const baseline = calculate(inputs, 0, eligible);
  let optimal = baseline;
  if (eligible > 0) {
    for (let pct = 1; pct <= MAX_SPLIT; pct++) {
      const candidate = calculate(inputs, pct, eligible);
      // Keep the smaller election if the modelled costs tie.
      if (candidate.total < optimal.total - 1e-8) optimal = candidate;
    }
  }
  const selected = manualPct !== null && eligible > 0 ? calculate(inputs, manualPct, eligible) : optimal;
  const annual = baseline.total - selected.total;
  return {
    eligible, baseline, optimal, selected,
    savings: {
      annual,
      incomeTax: baseline.taxWithoutPension - selected.taxWithoutPension,
      oas: baseline.oasRecovery - selected.oasRecovery,
      pension: selected.pensionCredit - baseline.pensionCredit,
      tenYear: annual * 10,
    },
  };
}
