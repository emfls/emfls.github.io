const CURRENT = { ratePerThousand: 150, threshold: 500000, reliefThreshold: 5027000, allowance: 1050000 };
const LEGACY = { ratePerThousand: 138, threshold: 910000, reliefThreshold: 5027000, allowance: 500000 };
const MAX_SALARY = 10000000;
const MAX_HEADCOUNT = 10000;

function salaryInPence(salary) {
  if (!Number.isFinite(salary) || salary < 0 || salary > MAX_SALARY) {
    throw new RangeError('Enter each salary between £0 and £10,000,000.');
  }
  const pence = Math.round(salary * 100);
  if (pence / 100 !== salary) {
    throw new RangeError('Enter salaries to the nearest penny.');
  }
  return pence;
}

function payrollGroup({ count, salary }, hasRelief = false) {
  if (!Number.isInteger(count) || count < 0 || count > MAX_HEADCOUNT) {
    throw new RangeError('Enter a whole headcount from 0 to 10,000 for each group.');
  }
  return { count, pay: salaryInPence(salary), hasRelief };
}

function grossNI(groups, rules) {
  return groups.reduce((total, { count, pay, hasRelief }) => {
    const threshold = hasRelief ? rules.reliefThreshold : rules.threshold;
    const taxablePay = Math.max(0, pay - threshold);
    return total + count * Math.round(taxablePay * rules.ratePerThousand / 1000);
  }, 0);
}

function summarise(gross, pay, allowance) {
  const applied = Math.min(gross, allowance);
  const net = gross - applied;
  return {
    grossNI: gross / 100,
    allowanceApplied: applied / 100,
    unusedAllowance: (allowance - applied) / 100,
    netNI: net / 100,
    monthlyNetNI: Math.round(net / 12) / 100,
    effectiveRate: pay > 0 ? 100 * net / pay : 0,
    payrollCost: (pay + net) / 100,
  };
}

export function calculatePayroll({ eligibility, standard, directors, relief, legacyBelowCap, hireSalary }) {
  if (!['eligible_multi_employee', 'single_director_only', 'public_sector_ineligible'].includes(eligibility)) {
    throw new RangeError('Choose an employer eligibility scenario.');
  }
  if (typeof legacyBelowCap !== 'boolean') {
    throw new RangeError('Specify whether the historical Employment Allowance cap was met.');
  }

  const groups = [payrollGroup(standard), payrollGroup(directors), payrollGroup(relief, true)];
  const soleDirector = eligibility === 'single_director_only';
  if (soleDirector && (groups[1].count !== 1 ||
      [groups[0], groups[2]].some(group => group.count > 0 && group.pay > CURRENT.threshold))) {
    throw new RangeError('The sole-director scenario requires one director and no other staff above the secondary threshold.');
  }

  const pay = groups.reduce((total, group) => total + group.count * group.pay, 0);
  const eligible = eligibility === 'eligible_multi_employee';
  const currentGross = grossNI(groups, CURRENT);
  const current = summarise(currentGross, pay, eligible ? CURRENT.allowance : 0);
  const legacy = summarise(grossNI(groups, LEGACY), pay, eligible && legacyBelowCap ? LEGACY.allowance : 0);
  const hirePay = salaryInPence(hireSalary);
  let hire = null;

  if (hirePay > 0) {
    const hireGross = grossNI([{ count: 1, pay: hirePay, hasRelief: false }], CURRENT);
    const unlocksAllowance = soleDirector && hirePay > CURRENT.threshold;
    const afterHire = summarise(currentGross + hireGross, pay + hirePay,
      eligible || unlocksAllowance ? CURRENT.allowance : 0);
    const marginal = Math.round(afterHire.netNI * 100) - Math.round(current.netNI * 100);
    hire = {
      grossNI: hireGross / 100,
      allowanceApplied: afterHire.allowanceApplied,
      netNI: afterHire.netNI,
      marginalNI: marginal / 100,
      marginalPayrollCost: (hirePay + marginal) / 100,
      unlocksAllowance,
    };
  }

  return {
    salary: pay / 100,
    current,
    legacy,
    changeVsLegacy: (Math.round(current.netNI * 100) - Math.round(legacy.netNI * 100)) / 100,
    hire,
  };
}
