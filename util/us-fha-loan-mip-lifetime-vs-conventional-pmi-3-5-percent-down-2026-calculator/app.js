import { calcFhaVsConventional, FHA_CONSTANTS_2026 } from './model.mjs';

function formatCurr(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function formatDec(val, dec = 2) {
  return Number(val).toFixed(dec);
}

function updateCalculator() {
  const homePrice = parseFloat(document.getElementById('homePrice').value) || 450000;
  const fhaDownPercent = parseFloat(document.getElementById('fhaDownPercent').value) || 3.5;
  const convDownPercent = parseFloat(document.getElementById('convDownPercent').value) || 5.0;
  const fhaInterestRate = parseFloat(document.getElementById('fhaInterestRate').value) || 6.25;
  const convInterestRate = parseFloat(document.getElementById('convInterestRate').value) || 6.75;
  const convPmiAnnualRate = parseFloat(document.getElementById('convPmiAnnualRate').value) || 0.65;
  const appreciationRate = parseFloat(document.getElementById('appreciationRate').value) || 3.5;
  const financeUfmip = document.getElementById('financeUfmip').checked;

  const result = calcFhaVsConventional({
    homePrice,
    fhaDownPercent,
    convDownPercent,
    fhaInterestRate,
    convInterestRate,
    convPmiAnnualRate,
    appreciationRate,
    financeUfmip
  });

  // Summary Banner
  const winnerBadge = document.getElementById('winnerBadge');
  const summaryText = document.getElementById('summaryText');
  if (result.initialMonthlyDiff < 0) {
    winnerBadge.innerText = 'FHA Cheaper Initially (Lower Rate)';
    winnerBadge.className = 'pill-tag bg-emerald';
    summaryText.innerHTML = `FHA saves <strong>${formatCurr(Math.abs(result.initialMonthlyDiff))}</strong>/mo initially due to the lower interest rate, but conventional PMI drops at month <strong>${result.convPmiDropMonth}</strong>, saving <strong>${formatCurr(result.totalMiDifference)}</strong> in lifetime mortgage insurance.`;
  } else {
    winnerBadge.innerText = 'Conventional Cheaper Monthly';
    winnerBadge.className = 'pill-tag bg-blue';
    summaryText.innerHTML = `Conventional saves <strong>${formatCurr(result.initialMonthlyDiff)}</strong>/month right away and saves <strong>${formatCurr(result.totalMiDifference)}</strong> in total insurance fees over 30 years.`;
  }

  // Monthly Payment comparison
  document.getElementById('fhaInitialMonthly').innerText = formatCurr(result.fhaInitialTotalMonthly);
  document.getElementById('convInitialMonthly').innerText = formatCurr(result.convInitialTotalMonthly);
  document.getElementById('fhaMonthlyPI').innerText = formatCurr(result.fhaMonthlyPI);
  document.getElementById('convMonthlyPI').innerText = formatCurr(result.convMonthlyPI);
  document.getElementById('fhaMonthlyMip').innerText = formatCurr(result.fhaInitialMonthlyMip);
  document.getElementById('convMonthlyPmi').innerText = formatCurr(result.convInitialMonthlyPmi);

  // Upfront & Loan Limits
  document.getElementById('fhaDownPaid').innerText = formatCurr(result.fhaDownPayment);
  document.getElementById('convDownPaid').innerText = formatCurr(result.convDownPayment);
  document.getElementById('ufmipFinanced').innerText = formatCurr(result.ufmipAmount);
  document.getElementById('fhaTotalLoan').innerText = formatCurr(result.fhaTotalLoan);
  document.getElementById('convTotalLoan').innerText = formatCurr(result.convLoan);

  // Lifetime Insurance comparison
  document.getElementById('fhaTotalMip').innerText = formatCurr(result.fhaTotalMipPaid);
  document.getElementById('convTotalPmi').innerText = formatCurr(result.convTotalPmiPaid);
  document.getElementById('convPmiDropMonthDisplay').innerText = `Month ${result.convPmiDropMonth} (~${formatDec(result.convPmiDropMonth / 12, 1)} yrs)`;
  document.getElementById('fhaMipDurationDisplay').innerText = result.fhaMipMonths === 360 ? 'Lifetime (30 Years)' : '11 Years (132 mos)';

  // Cumulative Totals
  document.getElementById('fha5Yr').innerText = formatCurr(result.fhaTotalPaid5Yr);
  document.getElementById('conv5Yr').innerText = formatCurr(result.convTotalPaid5Yr);
  document.getElementById('fha10Yr').innerText = formatCurr(result.fhaTotalPaid10Yr);
  document.getElementById('conv10Yr').innerText = formatCurr(result.convTotalPaid10Yr);
  document.getElementById('fha30Yr').innerText = formatCurr(result.fhaTotalPaid30Yr);
  document.getElementById('conv30Yr').innerText = formatCurr(result.convTotalPaid30Yr);

  // Refi Strategy
  document.getElementById('natural80Month').innerText = `Month ${result.natural80LtvMonth} (~${formatDec(result.natural80LtvMonth / 12, 1)} yrs)`;
  document.getElementById('refiCostEst').innerText = formatCurr(result.estimatedRefiCost);
  document.getElementById('refiBreakevenDisplay').innerText = `~${result.refiBreakevenMonths} months post-refi (Total Month ${result.totalMonthsToRefiBreakeven})`;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('.calc-input');
  inputs.forEach(inp => inp.addEventListener('input', updateCalculator));
  document.getElementById('financeUfmip').addEventListener('change', updateCalculator);
  updateCalculator();
});
