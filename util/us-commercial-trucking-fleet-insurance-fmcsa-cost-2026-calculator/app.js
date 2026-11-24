import { calcTruckingInsurance, FMCSA_LIABILITY_MINIMUMS } from './model.mjs';

function fmtUSD(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const cargoType = document.getElementById('cargoType').value;
  const fleetSize = parseInt(document.getElementById('fleetSize').value, 10) || 1;
  const isNewAuthority = document.getElementById('isNewAuthority').checked;
  const operatingRadius = document.getElementById('operatingRadius').value;
  const tractorTrailerValue = parseFloat(document.getElementById('tractorTrailerValue').value) || 0;
  const hasPhysicalDamage = document.getElementById('hasPhysicalDamage').checked;
  const cargoLimit = document.getElementById('cargoLimit').value;
  const hasBobtail = document.getElementById('hasBobtail').checked;
  const annualMilesPerTruck = parseFloat(document.getElementById('annualMilesPerTruck').value) || 100000;

  const res = calcTruckingInsurance({
    cargoType,
    fleetSize,
    isNewAuthority,
    operatingRadius,
    tractorTrailerValue,
    hasPhysicalDamage,
    cargoLimit,
    hasBobtail,
    annualMilesPerTruck
  });

  // Display hero & main figures
  document.getElementById('resTotalAnnual').textContent = fmtUSD(res.totalAnnualPremium);
  document.getElementById('resMonthly').textContent = fmtUSD(res.monthlyPremium);
  document.getElementById('resCostPerTruck').textContent = fmtUSD(res.annualCostPerTruck);
  document.getElementById('resCpm').textContent = `$${res.costPerMile.toFixed(3)} / mile`;

  // Cover breakdowns
  document.getElementById('resPrimaryLiability').textContent = fmtUSD(res.totalPrimaryLiability);
  document.getElementById('resPhysicalDamage').textContent = fmtUSD(res.totalPhysicalDamage);
  document.getElementById('resCargo').textContent = fmtUSD(res.totalCargoInsurance);
  document.getElementById('resBobtail').textContent = fmtUSD(res.totalBobtail);

  // Authority note
  const authBox = document.getElementById('authNoticeBox');
  if (res.isNewAuthority) {
    authBox.style.display = 'block';
    document.getElementById('resAuthSavings').textContent = fmtUSD(res.authorityExperienceSavingsPerTruck);
  } else {
    authBox.style.display = 'none';
  }

  updateChart(res);
}

function updateChart(res) {
  const svg = document.getElementById('chartSvg');
  if (!svg) return;

  const primary = res.totalPrimaryLiability;
  const phys = res.totalPhysicalDamage;
  const cargo = res.totalCargoInsurance;
  const bobtail = res.totalBobtail;
  const total = Math.max(res.totalAnnualPremium, 1);

  const maxH = 140;
  const hPrimary = Math.max(6, (primary / total) * maxH);
  const hPhys = Math.max(6, (phys / total) * maxH);
  const hCargo = Math.max(6, (cargo / total) * maxH);
  const hBobtail = Math.max(6, (bobtail / total) * maxH);

  setBar('barPrimary', 'lblPrimary', 35, hPrimary, primary);
  setBar('barPhys', 'lblPhys', 105, hPhys, phys);
  setBar('barCargo', 'lblCargo', 175, hCargo, cargo);
  setBar('barBobtail', 'lblBobtail', 245, hBobtail, bobtail);
}

function setBar(barId, lblId, x, h, val) {
  const bar = document.getElementById(barId);
  const lbl = document.getElementById(lblId);
  if (bar) {
    bar.setAttribute('height', h.toFixed(1));
    bar.setAttribute('y', (170 - h).toFixed(1));
  }
  if (lbl) {
    lbl.textContent = fmtUSD(val);
    lbl.setAttribute('y', Math.max(14, 165 - h).toFixed(1));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const inputs = ['cargoType', 'fleetSize', 'isNewAuthority', 'operatingRadius', 'tractorTrailerValue', 'hasPhysicalDamage', 'cargoLimit', 'hasBobtail', 'annualMilesPerTruck'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalculator);
    if (el) el.addEventListener('change', updateCalculator);
  });
  updateCalculator();
});
