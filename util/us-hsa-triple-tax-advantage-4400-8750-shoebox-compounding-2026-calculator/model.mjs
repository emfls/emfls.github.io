export const LIMITS = Object.freeze({
  self: Object.freeze({ contribution: 4400, deductible: 1700, outOfPocket: 8500 }),
  family: Object.freeze({ contribution: 8750, deductible: 3400, outOfPocket: 17000 }),
  catchUp: 1000,
  socialSecurityWageBase: 184500,
});

const MEDICARE_THRESHOLD = { single: 200000, joint: 250000, separate: 125000 };

export function payrollTaxSavings(contribution, wages, filing, spouseWages = 0) {
  const reducedWages = Math.max(0, wages - contribution);
  const jointWages = filing === 'joint' ? spouseWages : 0;
  const threshold = MEDICARE_THRESHOLD[filing];
  return {
    socialSecurity: 0.062 * (Math.min(wages, LIMITS.socialSecurityWageBase)
      - Math.min(reducedWages, LIMITS.socialSecurityWageBase)),
    medicare: 0.0145 * (wages - reducedWages),
    additionalMedicare: 0.009 * (Math.max(0, wages + jointWages - threshold)
      - Math.max(0, reducedWages + jointWages - threshold)),
  };
}

function sumTaxes(taxes) {
  return taxes.socialSecurity + taxes.medicare + taxes.additionalMedicare;
}

export function contributionRoom(input) {
  const { coverage, deductible, outOfPocket, earlyPlanBenefits, specialPlan, eligible,
    age, spouseCatchUp, employer, planned } = input;
  const limits = LIMITS[coverage];
  const statutoryPass = deductible >= limits.deductible
    && outOfPocket >= deductible && outOfPocket <= limits.outOfPocket && !earlyPlanBenefits;
  const hdhpPass = specialPlan || statutoryPass;
  const canContribute = hdhpPass && eligible;
  const ownerCatchUp = age >= 55 ? LIMITS.catchUp : 0;
  const spouseRoom = canContribute && coverage === 'family' && spouseCatchUp ? LIMITS.catchUp : 0;
  const ownerLimit = canContribute ? limits.contribution + ownerCatchUp : 0;
  const available = Math.max(0, ownerLimit - employer);
  const election = Math.min(planned, available);
  return {
    statutoryPass, hdhpPass, canContribute, ownerLimit, spouseRoom, householdLimit: ownerLimit + spouseRoom,
    available, election, remaining: available - election, employerExcess: Math.max(0, employer - ownerLimit),
  };
}

// Distributions are reinvested net of current tax. Price gains are taxed only at sale.
export function invest(deposit, years, totalReturn, yieldRate = 0, dividendTax = 0, saleTax = 0) {
  let balance = 0;
  let basis = 0;
  let dividendTaxes = 0;
  for (let year = 0; year < years; year += 1) {
    const distribution = balance * yieldRate;
    const tax = distribution * dividendTax;
    balance += balance * totalReturn - tax + deposit;
    basis += distribution - tax + deposit;
    dividendTaxes += tax;
  }
  const gainTax = Math.max(0, balance - basis) * saleTax;
  return { balance, basis, dividendTaxes, gainTax, afterTax: balance - gainTax };
}

export function hsaWithdrawal(balance, receipts, age, ordinaryTax, stateSaleTax = 0) {
  const qualified = Math.min(balance, receipts);
  const nonMedical = balance - qualified;
  const incomeTax = nonMedical * ordinaryTax;
  const penalty = age < 65 ? nonMedical * 0.20 : 0;
  return { qualified, nonMedical, incomeTax, penalty, afterTax: balance - incomeTax - penalty - stateSaleTax };
}

export function calculate(input) {
  const room = contributionRoom(input);
  const { funding, wages, spouseWages, filing, state, federalRate, stateRate, retirementFederal,
    retirementState, totalReturn, yieldRate, dividendRate, gainRate, years, age, ownRothRoom,
    savedReceipts, annualReceipts } = input;
  const nonconforming = state === 'ca' || state === 'nj';
  const payroll = funding === 'payroll';
  const election = payroll ? Math.min(room.election, wages) : room.election;
  const fica = payrollTaxSavings(payroll ? election : 0, wages, filing, spouseWages);
  const federalSavings = election * federalRate;
  const stateSavings = nonconforming ? 0 : election * stateRate;
  const upfront = federalSavings + stateSavings + sumTaxes(fica);

  const gross = Math.min(election, wages);
  const alternativeFica = sumTaxes(payrollTaxSavings(gross, wages, filing, spouseWages));
  const currentOrdinary = federalRate + stateRate;
  const futureOrdinary = retirementFederal + retirementState;
  const ageAtExit = age + years;
  const receipts = savedReceipts + annualReceipts * years;

  // Taxes on the portion of the gross pay budget left uninvested are paid from that budget.
  const pretaxDeposit = Math.max(0, gross - alternativeFica / (1 - currentOrdinary));
  const afterTaxDeposit = Math.max(0, gross * (1 - currentOrdinary) - alternativeFica);
  const hsaDepositFor = (stateTaxesHsa) => {
    const cashTax = (payroll ? 0 : alternativeFica) + (stateTaxesHsa ? gross * stateRate : 0);
    const deductionRate = federalRate + (stateTaxesHsa ? 0 : stateRate);
    return Math.max(0, gross - cashTax / (1 - deductionRate));
  };

  const hsaDeposit = hsaDepositFor(nonconforming);
  const hsaFund = invest(hsaDeposit, years, totalReturn, yieldRate,
    nonconforming ? stateRate : 0, nonconforming ? retirementState : 0);
  const hsa = hsaWithdrawal(hsaFund.balance, receipts, ageAtExit,
    nonconforming ? retirementFederal : futureOrdinary, hsaFund.gainTax);
  const conformingBalance = invest(hsaDepositFor(false), years, totalReturn).balance;
  const conformingHsa = hsaWithdrawal(conformingBalance, receipts, ageAtExit, futureOrdinary);

  const traditional = invest(pretaxDeposit, years, totalReturn).balance
    * (1 - futureOrdinary - (ageAtExit < 59.5 ? 0.10 : 0));
  const rothDeposit = Math.min(afterTaxDeposit, ownRothRoom, age >= 50 ? 8600 : 7500);
  const rothFund = invest(rothDeposit, years, totalReturn);
  const rothEarnings = Math.max(0, rothFund.balance - rothFund.basis);
  const rothTax = years >= 5 && ageAtExit >= 59.5 ? 0
    : rothEarnings * (futureOrdinary + (ageAtExit < 59.5 ? 0.10 : 0));
  const brokerage = invest(afterTaxDeposit, years, totalReturn, yieldRate,
    dividendRate + stateRate, gainRate + retirementState);
  const rothOverflow = invest(afterTaxDeposit - rothDeposit, years, totalReturn, yieldRate,
    dividendRate + stateRate, gainRate + retirementState);

  return {
    ...room, election, remaining: room.available - election, fica, federalSavings, stateSavings, upfront,
    gross, ageAtExit, receipts, hsa, hsaFund, hsaDeposit, pretaxDeposit, rothDeposit, afterTaxDeposit,
    rothOverflow: rothOverflow.afterTax,
    fullyQualifiedHsa: hsaFund.afterTax,
    afterTax: { hsa: hsa.afterTax, traditional, roth: rothFund.balance - rothTax + rothOverflow.afterTax,
      brokerage: brokerage.afterTax },
    nonconforming, stateUpfrontCost: nonconforming ? election * stateRate : 0,
    stateInvestmentTaxes: hsaFund.dividendTaxes + hsaFund.gainTax,
    stateNetCost: nonconforming ? conformingHsa.afterTax - hsa.afterTax : 0,
  };
}
