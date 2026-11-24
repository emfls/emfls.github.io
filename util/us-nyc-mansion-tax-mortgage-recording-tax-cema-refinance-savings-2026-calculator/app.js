import { MAX_AMOUNT, calculatePurchase, calculateRefinance } from './model.mjs';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format;
const byId = (id) => document.getElementById(id);
const write = (id, value) => { byId(id).textContent = value; };
const property = byId('property');
const isCoop = () => property.value === 'coop';

function readAmount(id) {
  const input = byId(id);
  if (!input.validity.valid) {
    throw new RangeError(`${input.labels[0].textContent} must be between $0 and ${money(MAX_AMOUNT)}, with up to two decimal places.`);
  }
  return input.valueAsNumber;
}

function renderPurchase() {
  const { mansionTax, mansionRate, purchaseMrt, purchaseMrtRate, condoCoopDelta,
    totalBuyerTax, currentCliff, nextCliff } = calculatePurchase({
    purchasePrice: readAmount('purchase-price'),
    loanAmount: readAmount('purchase-loan'),
    isCoop: isCoop(),
  });

  write('mansion-tax', `${money(mansionTax)} · ${mansionRate.toFixed(2)}%`);
  write('purchase-mrt', `${money(purchaseMrt)} · ${purchaseMrtRate.toFixed(3)}%`);
  write('condo-coop-delta', money(condoCoopDelta));
  write('buyer-total', money(totalBuyerTax));

  const cliffs = [];
  if (currentCliff) {
    cliffs.push(`At the current tier’s ${money(currentCliff.threshold)} threshold, the mansion tax jumped ${money(currentCliff.increase)} compared with one cent below.`);
  }
  if (nextCliff) {
    cliffs.push(`At the next threshold of ${money(nextCliff.threshold)}, the mansion tax jumps ${money(nextCliff.increase)} compared with one cent below.`);
  }
  write('cliff-message', cliffs.join(' '));
}

function renderRefinance() {
  const coop = isCoop();
  byId('existing-principal').disabled = coop;
  byId('cema-fees').disabled = coop;
  const result = calculateRefinance({
    newLoanAmount: readAmount('new-loan'),
    existingUnpaidPrincipal: coop ? 0 : readAmount('existing-principal'),
    cemaBankLegalFees: coop ? 0 : readAmount('cema-fees'),
    isCoop: coop,
  });

  write('new-money', coop ? 'N/A' : money(result.gapAmount));
  write('full-mrt', money(result.fullMrt));
  write('cema-mrt', money(result.cemaMrt));
  write('net-savings', coop ? 'N/A' : money(result.netCemaSavings));
  if (coop) {
    write('break-even', 'Co-op share loans have no MRT to save.');
  } else if (result.minimumSavingBalance === null) {
    write('break-even', 'No balance produces savings. Fees meet or exceed the full MRT.');
  } else {
    write('break-even', `${money(result.minimumSavingBalance)} of assignable principal produces the first cent or more of savings at this new loan amount.`);
  }
}

function update(section, render) {
  const error = byId(`${section}-error`);
  const results = byId(`${section}-results`);
  try {
    render();
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
  }
}

function updatePurchase() { update('purchase', renderPurchase); }
function updateRefinance() { update('refinance', renderRefinance); }

byId('purchase-inputs').addEventListener('input', updatePurchase);
byId('refinance-inputs').addEventListener('input', updateRefinance);
property.addEventListener('change', () => {
  updatePurchase();
  updateRefinance();
});

updatePurchase();
updateRefinance();
