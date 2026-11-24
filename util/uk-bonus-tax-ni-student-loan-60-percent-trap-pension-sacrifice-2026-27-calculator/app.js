import { UK_TAX_CONSTANTS_2026_27, calcBonusTaxNiSacrifice } from './model.mjs';

function formatGBP(val) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const baseSalary = parseFloat(document.getElementById('base-salary').value) || 85000;
  const bonusGross = parseFloat(document.getElementById('bonus-gross').value) || 20000;
  const sacrificePercent = parseFloat(document.getElementById('sacrifice-slider').value) || 0;
  const studentLoanPlan = document.getElementById('student-loan').value;
  const hasPostgradLoan = document.getElementById('chk-postgrad').checked;
  const employerNiPassThrough = parseFloat(document.getElementById('employer-ni-share').value) || 0;

  document.getElementById('sacrifice-slider-val').textContent = `${sacrificePercent}%`;

  const res = calcBonusTaxNiSacrifice({
    baseSalary,
    bonusGross,
    sacrificePercent,
    studentLoanPlan,
    hasPostgradLoan,
    employerNiPassThrough
  });

  document.getElementById('out-net-cash').textContent = formatGBP(res.netBonusTakeHome);
  document.getElementById('out-pension-boost').textContent = formatGBP(res.totalPensionPotBoost);
  document.getElementById('out-effective-deduction-rate').textContent = `${res.effectiveMarginalTaxRate}%`;
  document.getElementById('out-deductions-lost').textContent = formatGBP(res.totalBonusDeductions);

  // Breakdown
  document.getElementById('breakdown-income-tax').textContent = formatGBP(res.bonusIncomeTax);
  document.getElementById('breakdown-ni').textContent = formatGBP(res.bonusNi);
  document.getElementById('breakdown-student-loan').textContent = formatGBP(res.bonusStudentLoan + res.bonusPostgradLoan);

  // Trap alert
  const trapBox = document.getElementById('trap-alert-box');
  if (res.enters60PercentTrap && res.trapExposureAmount > 0) {
    trapBox.style.display = 'block';
    document.getElementById('trap-exposed-amount').textContent = formatGBP(res.trapExposureAmount);
  } else {
    trapBox.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(el => {
    el.addEventListener('input', updateCalculator);
    el.addEventListener('change', updateCalculator);
  });
  updateCalculator();
});
