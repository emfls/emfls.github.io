const STATUSES = new Set(['single', 'hoh', 'mfj', 'mfs', 'qss']);
const SOCIAL_SECURITY_BASE = 18_450_000;
const dollars = cents => cents / 100;
const stepsAbove = (amount, threshold, step) => Math.ceil(Math.max(0, amount - threshold) / step);

function creditRate(agi, joint) {
  const firstReduction = Math.min(15, stepsAbove(agi, 1_500_000, 200_000));
  const secondReduction = joint
    ? stepsAbove(agi, 15_000_000, 400_000)
    : stepsAbove(agi, 7_500_000, 200_000);
  return Math.max(20, 50 - firstReduction - secondReduction);
}

export function careCreditRate(agi, status) {
  return creditRate(Math.round(agi * 100), status === 'mfj');
}

function ctcLimit(magi, joint, children) {
  return Math.max(0, children * 220_000 - 5000 * stepsAbove(magi, joint ? 40_000_000 : 20_000_000, 100_000));
}

export function childCreditLimit(magi, status, children) {
  return dollars(ctcLimit(Math.round(magi * 100), status === 'mfj', children));
}

// Basis points times cents, before rounding to cents.
function payrollTaxReduction(election, wages) {
  const medicareWages = Math.min(election, wages);
  const socialSecurityWages = Math.min(wages, SOCIAL_SECURITY_BASE)
    - Math.min(wages - medicareWages, SOCIAL_SECURITY_BASE);
  return socialSecurityWages * 620 + medicareWages * 145;
}

export function payrollSavings(fsa, wages) {
  return dollars(Math.round(payrollTaxReduction(Math.round(fsa * 100), Math.round(wages * 100)) / 10_000));
}

function amount(value, name, min = 0, max = 1_000_000_000) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`);
  }
  return Math.round(value * 100);
}

function count(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be a whole number from 0 to 100.`);
  }
  return value;
}

export function optimizeCare(inputs) {
  const { status, mfsLivingApart = false, actcEligible = true } = inputs;
  if (!STATUSES.has(status)) throw new RangeError('Choose a filing status.');

  const agi = amount(inputs.agi, 'AGI', -1_000_000_000);
  const wages = amount(inputs.wages, 'Your wages');
  const spouseWages = amount(inputs.spouseWages ?? 0, 'Spouse’s wages');
  const federalTax = amount(inputs.federalTax, 'Federal income tax');
  const federalRate = amount(inputs.federalRate, 'Federal marginal rate', 0, 100);
  const stateRate = amount(inputs.stateRate, 'State marginal rate', 0, 100);
  const expenses = amount(inputs.expenses, 'Qualified care expenses');
  const planLimit = amount(inputs.planLimit ?? 7500, 'Employer plan limit');
  const carePeople = count(inputs.carePeople, 'Qualifying people for care');
  const ctcChildren = count(inputs.ctcChildren, 'Qualifying children for CTC');

  const joint = status === 'mfj';
  const separate = status === 'mfs' && !mfsLivingApart;
  const careCap = separate ? 0 : Math.min(2, carePeople) * 300_000;
  const statutoryFsaLimit = separate ? 3750 : 7500;
  // Section 129 applies the earned-income test to wages after salary reduction.
  const max = carePeople === 0 ? 0 : Math.floor(Math.min(
    statutoryFsaLimit * 100, planLimit, expenses, wages / 2, joint || separate ? spouseWages : wages
  ) / 100);

  function compareElection(fsa) {
    const election = fsa * 100;
    const wagesAfterFsa = wages - election;
    const agiAfterFsa = agi - election;
    const careRate = creditRate(agiAfterFsa, joint);
    const remainingCreditCap = Math.max(0, careCap - election);
    const creditBase = Math.min(expenses - election, remainingCreditCap, wagesAfterFsa, joint ? spouseWages : wagesAfterFsa);
    const federalReduction = Math.min(federalTax * 10_000, election * federalRate);
    const taxAfterFsa = federalTax - Math.round(federalReduction / 10_000);
    const careCredit = Math.min(taxAfterFsa, Math.round(creditBase * careRate / 100));
    const childLimit = ctcLimit(agiAfterFsa, joint, ctcChildren);
    const ctc = Math.min(taxAfterFsa - careCredit, childLimit);
    const earnedIncome = wagesAfterFsa + (joint ? spouseWages : 0);
    const actc = actcEligible ? Math.min(
      childLimit - ctc, ctcChildren * 170_000, Math.round(Math.max(0, earnedIncome - 250_000) * 15 / 100)
    ) : 0;
    const fsaSavings = Math.round((federalReduction + election * stateRate + payrollTaxReduction(election, wages)) / 10_000);
    const careSavings = fsaSavings + careCredit;

    return {
      fsa, agiAfterFsa: dollars(agiAfterFsa), careRate, remainingCreditCap: dollars(remainingCreditCap),
      creditBase: dollars(creditBase), careCredit: dollars(careCredit), fsaSavings: dollars(fsaSavings),
      careSavings: dollars(careSavings), ctcLimit: dollars(childLimit), ctc: dollars(ctc),
      actc: dollars(actc), familyRelief: dollars(careSavings + ctc + actc)
    };
  }

  const creditOnly = compareElection(0);
  let best = creditOnly;
  let maxFsa = creditOnly;
  for (let fsa = 1; fsa <= max; fsa += 1) {
    maxFsa = compareElection(fsa);
    // Equal relief favors the lower election and less exposure to forfeiture.
    if (maxFsa.familyRelief > best.familyRelief) best = maxFsa;
  }
  const strategy = best.fsa === 0 ? 'credit' : best.fsa === max ? 'max' : best.careCredit > 0 ? 'hybrid' : 'partial';
  return {
    best: { ...best, strategy }, creditOnly, maxFsa, statutoryFsaLimit, allocationsTested: max + 1,
    gainOverCreditOnly: dollars(Math.round((best.familyRelief - creditOnly.familyRelief) * 100)),
    gainOverMaxFsa: dollars(Math.round((best.familyRelief - maxFsa.familyRelief) * 100))
  };
}
