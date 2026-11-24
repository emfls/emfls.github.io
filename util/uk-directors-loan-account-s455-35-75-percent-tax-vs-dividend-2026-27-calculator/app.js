import { calcDlaTax, UK_TAX_CONSTANTS_2026 } from './model.mjs';

function formatGBP(val) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const loanAmount = parseFloat(document.getElementById('loanAmount').value) || 50000;
  const directorTaxBracket = document.getElementById('directorTaxBracket').value || 'higher';
  const interestPaidByDirectorPercent = parseFloat(document.getElementById('interestPaid').value) || 0;
  const corpTaxRateChoice = parseFloat(document.getElementById('corpTaxRate').value) || 0.25;
  const monthsUntilRepayment = parseFloat(document.getElementById('monthsOverdrawn').value) || 24;

  const result = calcDlaTax({
    loanAmount,
    directorTaxBracket,
    interestPaidByDirectorPercent,
    corpTaxRateChoice,
    monthsUntilRepayment
  });

  // Summary Banner
  document.getElementById('recBadge').innerText = result.recommendation;
  document.getElementById('recSummary').innerText = result.recommendationSummary;

  // Option A Outputs
  document.getElementById('s455Amount').innerText = formatGBP(result.s455TaxPayable);
  document.getElementById('annualBikDisplay').innerText = `${formatGBP(result.totalAnnualBikCost)}/yr (${formatGBP(result.annualDirectorBikTax)} personal + ${formatGBP(result.annualClass1ANi)} Class 1A)`;
  document.getElementById('totalBikOverdrawn').innerText = formatGBP(result.multiYearBikCost);
  document.getElementById('optionATotalOutflow').innerText = formatGBP(result.optionACashOutflow);

  // Option B Outputs
  document.getElementById('dividendTaxRateDisplay').innerText = `${result.dividendRatePercent}%`;
  document.getElementById('dividendTaxAmount').innerText = formatGBP(result.directorDividendTax);
  document.getElementById('optionBTotal').innerText = formatGBP(result.optionBCost);

  // Option C Outputs
  document.getElementById('grossBonusNeeded').innerText = formatGBP(result.grossSalaryNeeded);
  document.getElementById('payeAndNi').innerText = formatGBP(result.employeeTaxAndNi);
  document.getElementById('employerNi').innerText = formatGBP(result.employerNiPaid);
  document.getElementById('ctRelief').innerText = `-${formatGBP(result.corpTaxSaving)}`;
  document.getElementById('optionCTotal').innerText = formatGBP(result.optionCNetCost);
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('.calc-input');
  inputs.forEach(inp => inp.addEventListener('input', updateCalculator));
  document.getElementById('directorTaxBracket').addEventListener('change', updateCalculator);
  document.getElementById('corpTaxRate').addEventListener('change', updateCalculator);
  updateCalculator();
});
