const TERMS = [10, 15, 20, 30];
const REGIONS = ['metro', 'regulatedProvince', 'province', 'rural'];
const RATES = [
  [20e6, 180, 190, 200, 205],
  [40e6, 215, 225, 235, 240],
  [60e6, 240, 250, 260, 265],
  [85e6, 265, 275, 285, 290],
  [100e6, 290, 300, 310, 320],
  [130e6, 320, 330, 340, 350],
  [150e6, 350, 360, 370, 380],
  [170e6, 385, 395, 405, 415],
  [200e6, 420, 430, 440, 450],
];

function requireCounts(...counts) {
  if (counts.some(value => !Number.isSafeInteger(value) || value < 0)) {
    throw new RangeError('A nonnegative integer is required.');
  }
}

function accountPoints(months) {
  if (months < 12) return months < 6 ? 1 : 2;
  return Math.min(17, Math.floor(months / 12) + 2);
}

export function subscriptionScore({ homelessMonths, dependents, ownMonths, spouseMonths }) {
  requireCounts(dependents, ownMonths, homelessMonths ?? 0, spouseMonths ?? 0);
  const homeless = homelessMonths === null ? 0 : Math.min(32, 2 * (Math.floor(homelessMonths / 12) + 1));
  const family = 5 + 5 * Math.min(6, dependents);
  const own = accountPoints(ownMonths);
  const spouse = spouseMonths === null ? 0 : Math.min(3, accountPoints(spouseMonths / 2));
  const account = Math.min(17, own + spouse);
  return { homeless, family, own, spouse, spouseApplied: account - own, account, total: homeless + family + account };
}

export function specialTerms(income, years, region, additionalChildren) {
  requireCounts(income, additionalChildren);
  const termIndex = TERMS.indexOf(years);
  if (termIndex === -1 || !REGIONS.includes(region) || additionalChildren > 2) {
    throw new RangeError('Unsupported loan scenario.');
  }
  const row = RATES.find(([ceiling]) => income <= ceiling);
  if (!row || income === 0) return null;
  const base = row[termIndex + 1];
  const provincialDiscount = region === 'metro' ? 0 : 20;
  const childDiscount = additionalChildren * 20;
  return {
    baseRate: base / 100,
    rate: Math.max(120, base - provincialDiscount - childDiscount) / 100,
    years: 5 + additionalChildren * 5,
  };
}

function repayment(principal, years, annualRate) {
  requireCounts(principal);
  if (!TERMS.includes(years) || !Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100) {
    throw new RangeError('Unsupported term or rate.');
  }
  const rate = annualRate / 1200;
  const months = years * 12;
  if (rate === 0) return { monthly: principal / months, interest60: 0 };
  const monthly = principal * rate / -Math.expm1(-months * Math.log1p(rate));
  let balance = principal;
  let interest60 = 0;
  for (let month = 0; month < 60; month += 1) {
    const interest = balance * rate;
    interest60 += interest;
    balance -= monthly - interest;
  }
  return { monthly, interest60 };
}

export function assessLoan({
  incomeA, incomeB, assets, price, appraisal, area, region, firstHome, newborn, eligibleHousehold,
  principal, annualDebtInterest, annualRate, years,
}) {
  requireCounts(incomeA, incomeB, price, appraisal, principal, annualDebtInterest);
  if (!Number.isSafeInteger(assets) || !Number.isFinite(area) || area <= 0 ||
      !REGIONS.includes(region) || price === 0 || appraisal === 0 || principal === 0) {
    throw new RangeError('Invalid household or property amount.');
  }
  const income = incomeA + incomeB;
  const dualIncome = incomeA > 0 && incomeB > 0;
  const ltv = firstHome && ['province', 'rural'].includes(region) ? 80 : 70;
  const limit = Math.min(400e6, price, Math.floor(appraisal * ltv / 100));
  const areaLimit = region === 'rural' ? 100 : 85;
  const annualDebt = annualRate === null ? null : repayment(principal, years, annualRate).monthly * 12 + annualDebtInterest;
  const dti = income > 0 && annualDebt !== null ? annualDebt / income * 100 : null;
  const issues = [];
  if (!eligibleHousehold) issues.push('household');
  if (!newborn) issues.push('newborn');
  if (income === 0 || income > (dualIncome ? 200e6 : 130e6)) issues.push('combinedIncome');
  if (dualIncome && Math.max(incomeA, incomeB) > 130e6) issues.push('individualIncome');
  if (assets > 511e6) issues.push('assets');
  if (appraisal > 900e6) issues.push('appraisal');
  if (area > areaLimit) issues.push('area');
  if (principal > limit) issues.push('principal');
  if (annualDebt !== null && annualDebt > income * 0.6 + 1e-6) issues.push('dti');
  return { issues, ltv, limit, dti };
}

export function compareRepayments(principal, years, specialRate, standardRate) {
  const special = repayment(principal, years, specialRate);
  const standard = repayment(principal, years, standardRate);
  return {
    special, standard,
    monthlySaved: standard.monthly - special.monthly,
    interestSaved: standard.interest60 - special.interest60,
  };
}
