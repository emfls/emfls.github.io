import { compareClosingTaxes, MD_COUNTIES } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const results = byId('results');
const inputError = byId('input-error');
const countyInput = byId('md-county');
const transferInput = byId('md-transfer-rate');
const recordationInput = byId('md-recordation-rate');
const amountCells = [...results.querySelectorAll('[data-result]')];
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = value => currency.format(value);
const number = id => byId(id).valueAsNumber;
const checked = id => byId(id).checked;
const set = (id, value) => { byId(id).textContent = value; };
const optionalRate = input => input.value === '' && !input.validity.badInput ? undefined : input.valueAsNumber;

const badgeText = {
  QUALIFIED_0_725_PCT: 'Qualifies for 0.725%',
  DISQUALIFIED_PRICE_OR_AGI: 'Ineligible · price or AGI above cap',
  DISQUALIFIED_HOMESTEAD_OR_HISTORY: 'Standard rate · ownership or homestead criteria',
  INCOME_CAP_UNAVAILABLE: 'Standard rate shown · confirm AGI cap with DC OTR'
};

function showCountyDefaults() {
  const county = countyInput.value;
  const preset = MD_COUNTIES[county];
  const recordation = county === 'montgomery'
    ? 'Tiered recordation starting at $8.90 per $1,000'
    : `${money(preset.recordationPerThousand)} per $1,000 recordation`;
  const transfer = county === 'anneArundel' && number('md-price') >= 1000000
    ? 1.5 : preset.transferPercent;
  transferInput.placeholder = String(transfer);
  recordationInput.placeholder = county === 'montgomery' ? 'Use tiered rates' : String(preset.recordationPerThousand);
  byId('montgomery-option').hidden = county !== 'montgomery';
  set('local-defaults', `${preset.name} preset · ${transfer}% local transfer · ${recordation}`);
}

function update() {
  showCountyDefaults();
  let comparison;
  try {
    comparison = compareClosingTaxes({
      price: number('dc-price'),
      agi: number('dc-agi'),
      household: number('dc-household'),
      firstTime: checked('dc-first'),
      period: byId('dc-period').value
    }, {
      price: number('md-price'),
      county: countyInput.value,
      firstTime: checked('md-first'),
      montgomeryExemption: checked('md-montgomery-exemption'),
      transferPercent: optionalRate(transferInput),
      recordationPerThousand: optionalRate(recordationInput),
      transferDeduction: number('md-transfer-deduction'),
      recordationDeduction: number('md-recordation-deduction'),
      buyerLocalPercent: number('md-buyer-share')
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    results.hidden = true;
    inputError.textContent = error.message;
    inputError.hidden = false;
    return;
  }

  const { dc, md, buyerSavingsInMaryland } = comparison;
  set('dc-result', `${money(dc.buyerRecordation)} · ${dc.recordationPercent}%`);
  set('dc-badge', badgeText[dc.eligibility]);
  byId('dc-badge').dataset.state = dc.eligibility;
  const incomeLimit = dc.agiCap === null ? 'AGI cap unavailable for this household size' : `${money(dc.agiCap)} AGI cap`;
  set('dc-limit', `${money(dc.priceCap)} price cap · ${incomeLimit}`);
  set('md-result-label', `${MD_COUNTIES[countyInput.value].name} buyer total`);
  set('md-result', money(md.buyerTotal));
  set('md-seller', money(md.sellerTotal));
  let savingsLabel = 'Buyer deed taxes are equal';
  if (buyerSavingsInMaryland > 0) savingsLabel = 'Buyer pays less in Maryland by';
  if (buyerSavingsInMaryland < 0) savingsLabel = 'Buyer pays less in DC by';
  set('saving-label', savingsLabel);
  set('saving-result', money(Math.abs(buyerSavingsInMaryland)));

  for (const cell of amountCells) {
    const [location, line] = cell.dataset.result.split('.');
    cell.textContent = money(comparison[location][line]);
  }
  byId('yield-row').hidden = md.yieldTax === 0;
  inputError.hidden = true;
  results.hidden = false;
}

form.addEventListener('input', event => {
  if (event.target === countyInput) {
    transferInput.value = '';
    recordationInput.value = '';
    byId('md-transfer-deduction').value = '0';
    byId('md-recordation-deduction').value = '0';
  }
  update();
});
form.addEventListener('submit', event => event.preventDefault());
update();
