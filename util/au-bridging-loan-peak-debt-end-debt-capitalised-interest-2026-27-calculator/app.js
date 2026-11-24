import { calcBridgingLoan } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('bridging-form');
const error = get('input-error');
const results = get('results');

const dollars = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-AU', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function show(id, value) {
  const el = get(id);
  if (el) el.textContent = value;
}

function money(id, amount) {
  show(id, dollars.format(amount));
}

function updateChart(peakDebt, capInterest, netProceeds, endDebt) {
  show('chart-caption', 'Bridging loan debt transition');
  show('chart-desc', `Peak debt ${dollars.format(peakDebt)}, Capitalised interest ${dollars.format(capInterest)}, Net proceeds ${dollars.format(netProceeds)}, End debt ${dollars.format(endDebt)}.`);
  const scale = Math.max(peakDebt + capInterest, 1);
  const barPeak = get('bar-peak-debt');
  const barEnd = get('bar-end-debt');
  if (barPeak) barPeak.setAttribute('width', String(Math.max(4, 380 * (peakDebt / scale))));
  if (barEnd) barEnd.setAttribute('width', String(Math.max(4, 380 * (endDebt / scale))));
  money('bar-val-peak-debt', peakDebt);
  money('bar-val-end-debt', endDebt);
}

function render(res) {
  money('primary-value', res.endDebt);
  money('secondary-value', res.totalCapitalisedInterest);
  show('live-summary', `Ongoing end debt: ${dollars.format(res.endDebt)} (${res.endLvr.toFixed(1)}% LVR). Total capitalised interest during bridging: ${dollars.format(res.totalCapitalisedInterest)}. Peak debt: ${dollars.format(res.finalPeakDebt)}.`);

  money('initial-peak-val', res.initialPeakDebt);
  show('peak-lvr-val', `${res.peakLvr.toFixed(1)}%`);
  money('final-peak-val', res.finalPeakDebt);
  money('cap-interest-val', res.totalCapitalisedInterest);
  money('net-proceeds-val', res.netProceeds);
  money('end-debt-val', res.endDebt);
  show('end-lvr-val', `${res.endLvr.toFixed(1)}%`);
  money('end-pmt-val', res.endDebtMonthlyPayment);

  // Status badges
  const peakBadge = get('peak-lvr-badge');
  if (peakBadge) {
    peakBadge.textContent = res.isPeakLvrSafe ? 'Pass (<=80% APRA Safe)' : 'Warning (>80% LMI Risk)';
    peakBadge.style.color = res.isPeakLvrSafe ? '#166534' : '#991b1b';
  }

  // Stress test rows
  const stressRows = get('stress-tbody');
  if (stressRows && res.stressScenarios) {
    stressRows.replaceChildren(...res.stressScenarios.map(sc => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <th scope="row">-${sc.dropPct}% discount</th>
        <td>${dollars.format(sc.salePrice)}</td>
        <td>${dollars.format(sc.netProceeds)}</td>
        <td><strong>${dollars.format(sc.endDebt)}</strong></td>
        <td>${sc.endLvr.toFixed(1)}%</td>
        <td>${dollars.format(sc.monthlyPayment)}/mo</td>
      `;
      return tr;
    }));
  }

  updateChart(res.initialPeakDebt, res.totalCapitalisedInterest, res.netProceeds, res.endDebt);
}

function update() {
  const invalid = form.querySelector('input:invalid');
  for (const field of form.querySelectorAll('[aria-invalid]')) {
    field.removeAttribute('aria-invalid');
  }
  results.hidden = Boolean(invalid);
  error.hidden = !invalid;
  if (invalid) {
    invalid.setAttribute('aria-invalid', 'true');
    error.textContent = `${invalid.labels?.[0]?.textContent || 'Input'} ${invalid.validationMessage}`;
    return;
  }

  const inputs = {
    existingPropertyValue: Number(get('exist-val').value),
    existingMortgage: Number(get('exist-debt').value),
    newPurchasePrice: Number(get('new-price').value),
    purchaseCosts: Number(get('purchase-costs').value),
    depositContributed: Number(get('cash-deposit').value),
    bridgingPeriodMonths: Number(get('bridge-months').value),
    bridgingRate: Number(get('bridge-rate').value) / 100,
    expectedSalePrice: Number(get('sale-price').value),
    sellingCosts: Number(get('selling-costs').value),
    endDebtTermYears: Number(get('end-term').value),
    endDebtRate: Number(get('end-rate').value) / 100
  };

  try {
    const res = calcBridgingLoan(inputs);
    render(res);
  } catch (err) {
    results.hidden = true;
    error.hidden = false;
    error.textContent = err.message;
  }
}

function setPreset(months) {
  get('bridge-months').value = String(months);
  update();
}

form.addEventListener('input', update);
form.addEventListener('submit', (e) => e.preventDefault());
get('preset-6mo').addEventListener('click', () => setPreset(6));
get('preset-12mo').addEventListener('click', () => setPreset(12));
update();
