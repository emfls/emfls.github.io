import { calculate } from './model.mjs';

const form = document.querySelector('#calculator');
const results = document.querySelector('#results');
const warning = document.querySelector('#refund-trap');
const dollars = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });
const money = amount => dollars.format(amount);

function accountCard(account, reinvest, spend) {
  if (!reinvest) {
    return '<article><h3>FHSA</h3><p>Unavailable for the qualifying withdrawal scenario. Check your eligibility and closure deadline.</p></article>';
  }

  return `<article>
    <h3>${account}</h3>
    <dl>
      <dt>${spend ? 'Ending wealth · refund reinvested' : 'Ending wealth'}</dt><dd class="primary">${money(reinvest.endingWealth)}</dd>
      <dt>Deposit</dt><dd>${money(reinvest.deposit)}</dd>
      ${spend ? `<dt>Estimated deduction savings</dt><dd>${money(reinvest.refund)}</dd>` : ''}
      <dt>Unused savings in cash</dt><dd>${money(reinvest.unusedCash)}</dd>
      ${spend ? `<dt>Ending wealth · refund spent</dt><dd>${money(spend.endingWealth)}</dd>
        <dt>Deposit when spending refund</dt><dd>${money(spend.deposit)}</dd>
        <dt>Refund consumed today</dt><dd>${money(spend.spentRefund)}</dd>` : ''}
    </dl>
  </article>`;
}

function render() {
  const input = Object.fromEntries(new FormData(form));
  input.fhsaEligible = input.fhsaEligible === 'yes';
  const plan = calculate(input);
  const { FHSA, RRSP, TFSA } = plan.comparisons;
  const allocation = plan.allocation;
  const accounts = ['FHSA', 'RRSP', 'TFSA'];
  const tfsaFirst = allocation.TFSA > 0 && plan.nextRRSPRate <= plan.retirementRate + 1e-8;
  const order = tfsaFirst ? ['FHSA', 'TFSA', 'RRSP'] : accounts;
  results.innerHTML = `
    <dl class="metrics">
      <div><dt>Same after-tax starting budget</dt><dd>${money(plan.cashBudget)}</dd></div>
      <div><dt>Estimated current marginal rate</dt><dd>${percent.format(plan.currentRate)}</dd></div>
      <div><dt>RRSP withdrawal rate used</dt><dd>${percent.format(plan.retirementRate)}</dd></div>
    </dl>
    <div class="cards">
      ${accountCard('FHSA', FHSA?.reinvest, FHSA?.spend)}
      ${accountCard('RRSP', RRSP.reinvest, RRSP.spend)}
      ${accountCard('TFSA', TFSA)}
    </div>
    <h3 style="margin-top: 24px">Contribution waterfall</h3>
    <ul class="waterfall">
      ${order.map(account => `<li><strong>${account}</strong><span>${money(allocation[account])} of ${money(plan.room[account])} available</span></li>`).join('')}
      <li><strong>Cash left outside the accounts</strong><span>${money(allocation.unusedCash)}</span></li>
    </ul>
    <p>Combined tax savings <strong>${money(allocation.refund)}</strong>. Projected after-tax wealth <strong>${money(allocation.endingWealth)}</strong>.</p>`;

  const difference = RRSP.reinvest.endingWealth - RRSP.spend.endingWealth;
  warning.textContent = difference >= 0.005
    ? `Spending the estimated RRSP refund in this scenario leaves ${money(difference)} less in projected ending wealth. RRSP withdrawals remain taxable either way.`
    : 'The RRSP refund choice produces no difference in projected ending wealth with these inputs. RRSP withdrawals remain taxable.';
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', event => event.preventDefault());
render();

// Request ads once each when the publisher's actual ad-unit IDs are configured.
for (const ad of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (ad.dataset.adSlot) (window.adsbygoogle ||= []).push({});
}
