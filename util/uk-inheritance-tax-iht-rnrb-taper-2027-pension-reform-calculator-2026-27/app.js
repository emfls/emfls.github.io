import { calculateIht } from './model.mjs';

const form = document.getElementById('iht-form');
const giftList = document.getElementById('gifts');
const giftTemplate = document.getElementById('gift-template');
const addButton = document.getElementById('add-gift');
const comparison = document.getElementById('comparison');
const error = document.getElementById('error');
const status = document.getElementById('result-status');
const metrics = comparison.querySelectorAll('[data-metric]');
const extraIht = document.getElementById('extra-iht');
const residenceBandLost = document.getElementById('residence-band-lost');
const money = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat('en-GB', { style: 'percent' });
let giftNumber = 0;

function updateEstimate() {
  const inputs = [...form.querySelectorAll('input[type="number"]')];
  for (const input of inputs) {
    if (input.validity.valid) input.removeAttribute('aria-invalid');
    else input.setAttribute('aria-invalid', 'true');
  }

  try {
    const invalid = inputs.find(input => !input.validity.valid);
    if (invalid) {
      const label = invalid.labels[0];
      const field = label.firstChild.textContent.trim();
      throw new RangeError(`Check ${field}. ${invalid.validationMessage}`);
    }

    const estate = Object.fromEntries(
      inputs.filter(input => input.id).map(input => [input.id, input.valueAsNumber]),
    );
    const gifts = [...giftList.children].map(gift => ({
      amount: gift.querySelector('.gift-amount').valueAsNumber,
      yearsAgo: Number(gift.querySelector('.gift-age').value),
    }));
    const result = calculateIht({ ...estate, gifts });
    for (const row of metrics) {
      const key = row.dataset.metric;
      const formatter = key === 'estateRate' ? percent : money;
      row.cells[1].textContent = formatter.format(result.before[key]);
      row.cells[2].textContent = formatter.format(result.after[key]);
    }
    extraIht.textContent = money.format(result.extraIht);
    residenceBandLost.textContent = money.format(result.residenceBandLost);
    error.hidden = true;
    error.textContent = '';
    status.textContent = '';
    comparison.hidden = false;
  } catch (failure) {
    if (!(failure instanceof RangeError)) throw failure;
    comparison.hidden = true;
    status.textContent = 'Correct the estate or gift inputs to see an estimate.';
    error.hidden = false;
    error.textContent = failure.message;
  }
}

function addGift(amount, yearsAgo, focus = true) {
  const gift = giftTemplate.content.firstElementChild.cloneNode(true);
  const giftAmount = gift.querySelector('.gift-amount');
  const removeButton = gift.querySelector('.remove-gift');
  const number = ++giftNumber;
  gift.querySelector('legend').textContent = `Gift ${number}`;
  giftAmount.value = amount;
  gift.querySelector('.gift-age').value = yearsAgo;
  removeButton.setAttribute('aria-label', `Remove gift ${number}`);
  removeButton.addEventListener('click', () => {
    const nextGift = gift.nextElementSibling ?? gift.previousElementSibling;
    gift.remove();
    (nextGift?.querySelector('.remove-gift') ?? addButton).focus();
    updateEstimate();
  });
  giftList.append(gift);
  if (focus) giftAmount.focus();
  updateEstimate();
}

form.addEventListener('input', updateEstimate);
form.addEventListener('submit', event => {
  event.preventDefault();
  updateEstimate();
});
addButton.addEventListener('click', () => addGift(0, 0));
addGift(50_000, 4, false);
