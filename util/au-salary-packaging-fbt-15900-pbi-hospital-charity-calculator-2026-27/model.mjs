export const FBT_RATE = 0.47;
export const GROSS_UP = Object.freeze({ type1: 2.0802, type2: 1.8868 });
const MEAL_CAP = 5000;
const REBATE_RATE = 0.47;
const GENERAL_CAP = Object.freeze({ pbi: 30000, hospital: 17000, rebatable: 30000, corporate: 0 });

export function residentIncomeTax(income) {
  const tax = Math.max(0, Math.min(income, 45000) - 18200) * 0.15
    + Math.max(0, Math.min(income, 135000) - 45000) * 0.30
    + Math.max(0, Math.min(income, 190000) - 135000) * 0.37
    + Math.max(0, income - 190000) * 0.45;
  const offset = income <= 45000
    ? 700 - Math.max(0, income - 37500) * 0.05
    : Math.max(0, 325 - (income - 45000) * 0.015);
  return Math.max(0, tax - offset);
}

export function medicareLevy(income) {
  // Single, non-senior estimate using the July 2026 PAYG low-income threshold.
  return Math.min(income * 0.02, Math.max(0, income - 28011) * 0.10);
}

export function helpRepayment(income) {
  if (income >= 186051) return income * 0.10;
  if (income >= 129718) return 9028 + (income - 129717) * 0.17;
  return Math.max(0, income - 69528) * 0.15;
}

export function singleMls(income) {
  if (income >= 164001) return income * 0.015;
  if (income >= 123001) return income * 0.0125;
  if (income >= 105001) return income * 0.01;
  return 0;
}

export function calculatePackaging({
  salary, sector, living, meals, livingType = 'type2', mealsType = 'type2',
  annualFee = 0, helpBalance = 0, hospitalCover = false, passThroughFbt = true,
}) {
  if (!Object.hasOwn(GENERAL_CAP, sector)
    || !Object.hasOwn(GROSS_UP, livingType) || !Object.hasOwn(GROSS_UP, mealsType)) {
    throw new RangeError('Select a valid employer category and benefit type.');
  }
  if ([salary, living, meals, annualFee, helpBalance].some(
    value => !Number.isFinite(value) || value < 0 || value > 10000000,
  )) {
    throw new RangeError('Enter amounts between A$0 and A$10,000,000.');
  }

  const packaged = living + meals;
  if (Math.round(packaged * 100) > Math.round(salary * 100)) {
    throw new RangeError('Packaged living expenses and meals combined cannot exceed your salary.');
  }

  const exemptEmployer = sector === 'pbi' || sector === 'hospital';
  const livingGrossed = living * GROSS_UP[livingType];
  const mealGrossed = meals * GROSS_UP[mealsType];
  const totalGrossed = livingGrossed + mealGrossed;
  const mealCapUsed = sector === 'corporate' ? 0 : Math.min(mealGrossed, MEAL_CAP);
  const withinCaps = Math.min(totalGrossed - mealCapUsed, GENERAL_CAP[sector]) + mealCapUsed;
  const aboveCaps = Math.max(0, totalGrossed - withinCaps);
  const rebate = sector === 'rebatable' ? withinCaps * FBT_RATE * REBATE_RATE : 0;
  const employerFbt = (exemptEmployer ? aboveCaps : totalGrossed) * FBT_RATE - rebate;
  const fbtCost = passThroughFbt ? employerFbt : 0;
  const rfba = packaged > 2000 ? packaged * GROSS_UP.type2 : 0;
  const fee = packaged > 0 ? annualFee : 0;

  function scenario(cashSalary, reportableBenefits, benefits, cost) {
    const standardDeduction = Math.min(cashSalary, 1000);
    const taxable = cashSalary - standardDeduction;
    const incomeTax = residentIncomeTax(taxable);
    const levy = medicareLevy(taxable);
    const repaymentIncome = taxable + reportableBenefits;
    // Threshold bands use whole-dollar income. RFBA is shown unrounded as an estimate.
    const help = Math.min(helpBalance, helpRepayment(Math.floor(repaymentIncome)));
    const mls = hospitalCover ? 0 : singleMls(Math.floor(repaymentIncome));
    const cash = cashSalary - incomeTax - levy - help - mls - cost;
    const ccsIncome = taxable + reportableBenefits * (exemptEmployer ? 1 - FBT_RATE : 1);
    return {
      taxable, standardDeduction, incomeTax, levy, repaymentIncome, help, mls, cash, ccsIncome,
      spendingPower: cash + benefits,
    };
  }

  const before = scenario(salary, 0, 0, 0);
  const after = scenario(Math.max(0, salary - packaged), rfba, packaged, fee + fbtCost);
  const incomeTaxSaved = before.incomeTax - after.incomeTax;
  const levySaved = before.levy - after.levy;
  const extraHelp = after.help - before.help;
  const extraMls = after.mls - before.mls;
  const annualGain = incomeTaxSaved + levySaved - extraHelp - extraMls - fee - fbtCost;

  return {
    before, after, packaged, rfba, livingGrossed, mealGrossed, mealCapUsed, aboveCaps,
    rebate, employerFbt, fbtCost, fee, incomeTaxSaved, levySaved, extraHelp, extraMls,
    annualGain, fortnightGain: annualGain / 26,
  };
}
