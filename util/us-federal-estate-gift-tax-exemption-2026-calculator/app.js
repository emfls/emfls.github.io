import { calculateEstate, calculateGift, projectAnnualGiving } from './model.mjs';

const byId = id => document.getElementById(id);
const estateForm = byId('estate-form');
const giftForm = byId('gift-form');
const givingForm = byId('giving-form');
const spouseFields = byId('spouse-fields');
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const usd = amount => currency.format(amount);

function readNumber(input) {
  if (!input.validity.valid) {
    throw new RangeError(`${input.labels[0].textContent} ${input.validationMessage}`);
  }
  return input.valueAsNumber;
}

function readNumbers(form) {
  const inputs = form.querySelectorAll('input[type="number"]:enabled');
  return Object.fromEntries(Array.from(inputs, input => [input.id, readNumber(input)]));
}

function showAmounts(amounts) {
  for (const [id, amount] of Object.entries(amounts)) {
    const element = byId(id);
    if (element) element.textContent = usd(amount);
  }
}

function render(section, calculate) {
  const result = byId(`${section}-result`);
  const error = byId(`${section}-error`);
  try {
    calculate();
    error.hidden = true;
    result.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    result.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
  }
}

function renderEstate() {
  render('estate', () => {
    const { giftTaxPayable, ...amounts } = calculateEstate(readNumbers(estateForm));
    showAmounts({ ...amounts, giftTaxPayableResult: giftTaxPayable });
    const calculation = amounts.taxBase >= 1_000_000
      ? `$345,800 + 40% × ${usd(amounts.taxBase - 1_000_000)} = ${usd(amounts.tentativeTax)} tentative tax.`
      : `The applicable brackets yield ${usd(amounts.tentativeTax)} in tentative tax.`;
    byId('estate-math').textContent = `${calculation} Subtract ${usd(giftTaxPayable)} for line 7 and ${usd(amounts.unifiedCredit)} in unified credit, with a floor of $0.`;
  });
}

function updateSplitFields() {
  const split = byId('split').value === 'yes';
  spouseFields.hidden = !split;
  spouseFields.disabled = !split;
  for (const id of ['spouseUsed', 'spouseRemaining']) byId(id).parentElement.hidden = !split;
  return split;
}

function renderGift() {
  const split = updateSplitFields();
  render('gift', () => {
    const { giftDsue: dsue, ...inputs } = readNumbers(giftForm);
    const { donor, spouse, ...amounts } = calculateGift({ ...inputs, dsue, split });
    showAmounts({ ...amounts, donorUsed: donor.exclusionUsed, donorRemaining: donor.remainingExclusion });
    if (spouse) {
      showAmounts({ spouseUsed: spouse.exclusionUsed, spouseRemaining: spouse.remainingExclusion });
    }
  });
}

function renderGiving() {
  render('giving', () => {
    const estate = readNumbers(estateForm);
    const { years } = readNumbers(givingForm);
    const recipients = readNumber(byId('recipients'));
    const split = byId('split').value === 'yes';
    showAmounts(projectAnnualGiving(estate, { recipients, years, split }));
  });
}

function updateEstate() {
  renderEstate();
  renderGiving();
}

function updateGifts() {
  renderGift();
  renderGiving();
}

for (const [form, update] of [
  [estateForm, updateEstate], [giftForm, updateGifts], [givingForm, renderGiving],
]) {
  form.addEventListener('input', update);
  form.addEventListener('submit', event => event.preventDefault());
}

renderEstate();
renderGift();
renderGiving();

for (const ad of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(ad.dataset.adSlot)) (window.adsbygoogle ||= []).push({});
}
