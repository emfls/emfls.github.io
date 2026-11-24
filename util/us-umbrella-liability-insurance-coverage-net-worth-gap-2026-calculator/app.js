import { computeUmbrellaPlan } from './model.mjs';

function fmt(n) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }

function update() {
  const homeVal = parseFloat(document.getElementById('homeVal').value) || 0;
  const mortgage = parseFloat(document.getElementById('mortgage').value) || 0;
  const homestead = parseFloat(document.getElementById('homestead').value) || 0;
  const brokerage = parseFloat(document.getElementById('brokerage').value) || 0;
  const cash = parseFloat(document.getElementById('cash').value) || 0;
  const rentalEq = parseFloat(document.getElementById('rentalEq').value) || 0;
  const erisa = parseFloat(document.getElementById('erisa').value) || 0;
  const wages = parseFloat(document.getElementById('wages').value) || 0;

  const autoBI = parseFloat(document.getElementById('autoBI').value) || 250000;
  const autoPD = parseFloat(document.getElementById('autoPD').value) || 100000;
  const homeLiab = parseFloat(document.getElementById('homeLiab').value) || 300000;

  const teen = document.getElementById('teen').checked;
  const pool = document.getElementById('pool').checked;

  const res = computeUmbrellaPlan({
    homeValue: homeVal,
    mortgageBalance: mortgage,
    homesteadExemption: homestead,
    taxableInvestments: brokerage,
    bankCash: cash,
    rentalRealEstateEquity: rentalEq,
    erisaQualifiedRetirement: erisa,
    annualWages: wages,
    autoBI,
    autoPD,
    homeLiability: homeLiab,
    hasTeenDriver: teen,
    hasPool: pool
  });

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setEl('outExposedTotal', fmt(res.totalExposedNetWorth));
  setEl('outRecommendedTier', fmt(res.recommendedCoverage));
  setEl('outPremium', fmt(res.annualPremium) + '/yr');
  setEl('outProtectionPerDollar', fmt(res.protectionPerDollar));

  setEl('outExposedHome', fmt(res.exposedHomeEquity));
  setEl('outErisaProtected', fmt(res.erisaProtectedAmount) + ' (100% Protected)');
  setEl('outGarnishableWages', fmt(res.garnishableFutureWages));

  const gapAlert = document.getElementById('gapAlertBox');
  if (res.gaps.hasGap) {
    gapAlert.style.display = 'block';
  } else {
    gapAlert.style.display = 'none';
  }
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', update));
document.addEventListener('DOMContentLoaded', update);
