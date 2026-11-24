import { computeAULifeInsurance } from './model.mjs';

function fmt(n) { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n); }

function update() {
  const cover = parseFloat(document.getElementById('cover').value) || 1000000;
  const premium = parseFloat(document.getElementById('premium').value) || 1200;
  const mtr = parseFloat(document.getElementById('mtr').value) || 0.32;
  const beneficiary = document.getElementById('beneficiary').value;
  const element = document.getElementById('element').value;

  const res = computeAULifeInsurance({
    coverAmount: cover,
    annualPremiumRetail: premium,
    marginalTaxRate: mtr,
    beneficiaryType: beneficiary,
    taxElement: element
  });

  document.getElementById('outSuperCost').textContent = fmt(res.insideSuperNetCost) + '/yr';
  document.getElementById('outRetailPretax').textContent = fmt(res.retailPretaxSalaryRequired) + '/yr';
  document.getElementById('outAnnualSaved').textContent = fmt(res.annualCashSavingsToday) + '/yr';

  document.getElementById('outSuperPayout').textContent = fmt(res.superNetPayout);
  document.getElementById('outRetailPayout').textContent = fmt(res.retailNetPayout);
  document.getElementById('outDeathTax').textContent = fmt(res.superDeathTaxPayable) + ' (' + (res.deathTaxRate * 100).toFixed(0) + '%)';

  const taxBox = document.getElementById('taxAlertBox');
  if (res.deathTaxRate > 0) {
    taxBox.style.display = 'block';
    document.getElementById('taxLossDollars').textContent = fmt(res.deathTaxLossDollars);
  } else {
    taxBox.style.display = 'none';
  }

  document.getElementById('outSuperDrag').textContent = fmt(res.superBalanceDrag);
  document.getElementById('outCrossover').textContent = 'Year ' + res.crossoverYear;
  document.getElementById('outLevelSavings').textContent = fmt(res.levelTotalSavings20Yr);
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', update));
document.addEventListener('DOMContentLoaded', update);
