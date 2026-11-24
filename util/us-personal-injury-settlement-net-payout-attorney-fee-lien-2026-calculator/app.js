import { calcPersonalInjurySettlement } from './model.mjs';

function fmtUSD(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function updateCalculator() {
  const medicalBills = parseFloat(document.getElementById('medicalBills').value) || 0;
  const lostWages = parseFloat(document.getElementById('lostWages').value) || 0;
  const futureCare = parseFloat(document.getElementById('futureCare').value) || 0;
  const painSufferingMultiplier = parseFloat(document.getElementById('painSufferingMultiplier').value) || 2.5;
  const punitiveDamages = parseFloat(document.getElementById('punitiveDamages').value) || 0;
  const attorneyFeePercent = parseFloat(document.getElementById('attorneyFeePercent').value) || 33.33;
  const caseExpenses = parseFloat(document.getElementById('caseExpenses').value) || 0;
  const rawMedicalLiens = parseFloat(document.getElementById('rawMedicalLiens').value) || 0;
  const lienReductionPercent = parseFloat(document.getElementById('lienReductionPercent').value) || 0;
  const marginalTaxRate = parseFloat(document.getElementById('marginalTaxRate').value) || 28;

  const res = calcPersonalInjurySettlement({
    medicalBills,
    lostWages,
    futureCare,
    painSufferingMultiplier,
    punitiveDamages,
    attorneyFeePercent,
    caseExpenses,
    rawMedicalLiens,
    lienReductionPercent,
    marginalTaxRate
  });

  // Display hero results
  document.getElementById('resNetTakeHome').textContent = fmtUSD(res.netTakeHome);
  document.getElementById('resNetPercent').textContent = `${res.netTakeHomePercent.toFixed(1)}% of Gross Settlement`;
  document.getElementById('resGrossSettlement').textContent = fmtUSD(res.grossSettlement);

  // Breakdown lines
  document.getElementById('resPainSuffering').textContent = fmtUSD(res.painAndSuffering);
  document.getElementById('resAttorneyFee').textContent = fmtUSD(res.attorneyFeeAmount);
  document.getElementById('resCaseExpenses').textContent = fmtUSD(res.caseExpenses);
  document.getElementById('resFinalLiens').textContent = fmtUSD(res.finalMedicalLiensPaid);
  document.getElementById('resLienSavings').textContent = fmtUSD(res.lienSavings);
  document.getElementById('resTaxAmount').textContent = fmtUSD(res.taxLiability);
  document.getElementById('resTaxFreeComp').textContent = fmtUSD(res.taxFreeCompensatory);

  updateChart(res);
}

function updateChart(res) {
  const svg = document.getElementById('chartSvg');
  if (!svg) return;

  const gross = res.grossSettlement;
  const legal = res.attorneyFeeAmount + res.caseExpenses;
  const liens = res.finalMedicalLiensPaid;
  const taxes = res.taxLiability;
  const net = res.netTakeHome;
  const maxVal = Math.max(gross, 1);
  const maxH = 140;

  const hGross = Math.max(6, (gross / maxVal) * maxH);
  const hLegal = Math.max(6, (legal / maxVal) * maxH);
  const hLiens = Math.max(6, (liens / maxVal) * maxH);
  const hTaxes = Math.max(4, (taxes / maxVal) * maxH);
  const hNet = Math.max(6, (net / maxVal) * maxH);

  setBar('barGross', 'lblGross', 20, hGross, gross);
  setBar('barLegal', 'lblLegal', 80, hLegal, legal);
  setBar('barLiens', 'lblLiens', 140, hLiens, liens);
  setBar('barTaxes', 'lblTaxes', 200, hTaxes, taxes);
  setBar('barNet', 'lblNet', 260, hNet, net);
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
  const inputs = ['medicalBills', 'lostWages', 'futureCare', 'painSufferingMultiplier', 'punitiveDamages', 'attorneyFeePercent', 'caseExpenses', 'rawMedicalLiens', 'lienReductionPercent', 'marginalTaxRate'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCalculator);
    if (el) el.addEventListener('change', updateCalculator);
  });
  updateCalculator();
});
