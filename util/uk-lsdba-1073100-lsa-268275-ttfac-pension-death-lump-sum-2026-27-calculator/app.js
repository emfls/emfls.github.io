import { calculate } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('pension-form');
const fields = form.elements;
const custom = byId('custom-allowances');
const latePayment = byId('late-payment');
const results = byId('results');
const error = byId('form-error');
const verdict = byId('verdict');

const money = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 2,
});
const signed = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 2, signDisplay: 'exceptZero',
});
const verdicts = {
  APPLY_FOR_TTFAC: 'Consider applying for a TTFAC. The certificate improves at least one allowance without reducing the other on these inputs. Confirm your records with the scheme first.',
  DO_NOT_APPLY_WORSE_OFF: 'Keep the standard calculation on these inputs. A certificate would reduce your remaining allowance.',
  DO_NOT_APPLY_NO_GAIN: 'Both methods leave the same allowances on these inputs.',
  REVIEW_TRADE_OFF: 'One allowance improves and the other falls. Review the trade-off with your pension scheme before applying.',
  APPLICATION_UNAVAILABLE: 'The application window is closed on these inputs. The certificate column is a comparison only.',
  NO_PRIOR_LTA_USE: 'There is no reported pre-April 2024 LTA use to replace with a certificate.',
  CHECK_ELIGIBILITY: 'Confirm your eligibility and evidence with your pension scheme before relying on the certificate comparison.',
  CERTIFICATE_IN_FORCE: 'Use the certificate column if these are the certified amounts shown by your pension scheme.',
  NO_EVENT_TAX_BENEFIT: 'A certificate makes no difference to the Income Tax on this payment.',
};

function readScenario() {
  const regime = fields.regime.value;
  const event = fields.event.value;
  const isLifetime = event === 'lifetime_pcls';
  const isUnder75 = event === 'death_under_75_lump_sum';

  custom.hidden = custom.disabled = regime !== 'custom';
  latePayment.hidden = fields.lateUnder75Payment.disabled = !isUnder75;
  byId('amount-label').textContent = isLifetime ? 'Planned new crystallisation (£)' : 'Planned death benefit payment (£)';
  byId('amount-help').textContent = isLifetime
    ? 'Enter the total value being crystallised. The estimate assumes you take 25% as cash where the scheme allows it.'
    : 'Enter the gross amount payable to an individual beneficiary.';
  byId('certificate-help').textContent = isLifetime
    ? 'A member’s certificate must be in place before entitlement to the first relevant post-5 April 2024 lump sum.'
    : 'Eligible personal representatives have until 31 October following the tax year of payment, subject to prior lifetime lump sum entitlement.';
  byId('taxable-label').textContent = isLifetime ? 'Taxable cash excess' : 'Taxable payment';

  return {
    regime, event,
    customLsa: fields.customLsa.valueAsNumber,
    customLsdba: fields.customLsdba.valueAsNumber,
    customLta: fields.customLta.valueAsNumber,
    ltaUsed: fields.ltaUsed.valueAsNumber,
    historicCash: fields.historicCash.valueAsNumber,
    historicLsdbaOnly: fields.historicLsdbaOnly.valueAsNumber,
    priorCash: fields.priorCash.valueAsNumber,
    priorLsdbaOnly: fields.priorLsdbaOnly.valueAsNumber,
    amount: fields.amount.valueAsNumber,
    rate: Number(fields.rate.value),
    certificateStatus: fields.certificateStatus.value,
    fullLsdbaDeduction: fields.fullLsdbaDeduction.checked,
    lateUnder75Payment: isUnder75 && fields.lateUnder75Payment.checked,
  };
}

function render() {
  try {
    const scenario = readScenario();
    const estimate = calculate(scenario);
    for (const method of ['standard', 'ttfac']) {
      for (const [measure, value] of Object.entries(estimate[method])) {
        byId(`${method}-${measure}`).textContent = money.format(value);
      }
    }

    const { lsa, lsdba, taxFree } = estimate.delta;
    byId('payment-summary').textContent = scenario.event === 'lifetime_pcls'
      ? `Illustrative cash target: ${money.format(estimate.plannedCash)} (25% of the crystallisation).`
      : `Gross death benefit payment: ${money.format(estimate.plannedCash)}.`;
    byId('differences').textContent =
      `TTFAC difference: ${signed.format(lsa)} LSA, ${signed.format(lsdba)} LSDBA and ${signed.format(taxFree)} tax-free on this payment.`;
    verdict.dataset.code = estimate.verdict;
    verdict.dataset.tone = lsa < 0 || lsdba < 0 ? 'loss' : 'neutral';
    verdict.textContent = verdicts[estimate.verdict];
    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    error.hidden = false;
    error.textContent = issue.message;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
