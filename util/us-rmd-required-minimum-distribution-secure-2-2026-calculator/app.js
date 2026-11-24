import {
  TAX_YEAR, rmdForYear, calculateQcd, calculatePenalty, compareQcdIncomeTax, compareIrmaa, projectRmd,
} from './model.mjs';

const element = (id) => document.getElementById(id);
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const formatDate = (value) => date.format(new Date(`${value}T00:00:00Z`));
const set = (id, value) => { element(id).textContent = value; };

const rmdForm = element('rmd-form');
const qcdForm = element('qcd-form');
const growth = element('growth');
const rmdFields = ['rmd-amount', 'rmd-divisor', 'rmd-deadline', 'rmd-remaining'];
const qcdFields = ['qcd-excluded', 'qcd-taxable', 'federal-saved', 'state-saved', 'total-saved', 'irmaa-saved'];

function field(id) {
  const input = element(id);
  if (!input.validity.valid) throw new RangeError(`${input.labels[0].textContent}: ${input.validationMessage}`);
  return input.type === 'number' ? input.valueAsNumber : input.value;
}

function error(id, message) {
  set(id, message);
  element(id).hidden = !message;
}

function renderQcd(accountType) {
  const enabled = accountType === 'ira';
  qcdForm.hidden = !enabled;
  element('qcd-results').hidden = !enabled;
  element('qcd-intro').hidden = !enabled;
  element('qcd-method').hidden = !enabled;
  element('qcd-account-note').hidden = enabled;
  error('qcd-error', '');
  if (!enabled) return null;

  const filing = field('filing');
  for (const id of ['part-b', 'part-d']) {
    const select = element(id);
    select.options[2].disabled = filing !== 'mfj';
    if (filing !== 'mfj' && select.value === '2') select.value = '1';
  }

  let gift;
  try {
    gift = {
      accountType, birthDate: field('birth-date'), gift: field('gift'), giftDate: field('gift-date'),
      priorQcd: field('prior-qcd'), offset: field('offset'),
    };
  } catch (issue) {
    qcdFields.forEach((id) => set(id, '—'));
    set('eligibility-note', '');
    set('irmaa-result', '');
    error('qcd-error', issue.message);
    return null;
  }

  const qcd = calculateQcd(gift);
  set('qcd-excluded', money.format(qcd.excluded));
  set('qcd-taxable', money.format(qcd.taxable));
  set('eligibility-note', qcd.eligible
    ? `You meet the age requirement on the proposed transfer date. Your remaining annual QCD cap before contribution offsets is ${money.format(qcd.remainingCap)}.`
    : `You reach age 70½ on ${formatDate(qcd.eligibleDate)}. A withdrawal on the entered date receives no QCD exclusion.`);

  try {
    const tax = compareQcdIncomeTax({
      filing, ordinaryIncome: field('ordinary-income'), gift: gift.gift,
      excluded: qcd.excluded, stateRate: field('state-rate'),
    });
    const magi = field('magi');
    const withQcd = Math.round((magi + qcd.taxable) * 100) / 100;
    const withoutQcd = Math.round((magi + gift.gift) * 100) / 100;
    const irmaa = compareIrmaa({ filing, partB: Number(field('part-b')), partD: Number(field('part-d')), withQcd, withoutQcd });

    set('federal-saved', money.format(tax.federal));
    set('state-saved', money.format(tax.state));
    set('total-saved', money.format(tax.total));
    set('irmaa-saved', money.format(irmaa.saved));
    const tier = (value) => value === 0 ? 'no surcharge' : `surcharge tier ${value}`;
    set('irmaa-result', `2026 schedule comparison: ${money.format(withoutQcd)} MAGI (${tier(irmaa.beforeTier)}, ${money.format(irmaa.before)} per year) → ${money.format(withQcd)} MAGI (${tier(irmaa.afterTier)}, ${money.format(irmaa.after)} per year).`);
  } catch (issue) {
    qcdFields.slice(2).forEach((id) => set(id, '—'));
    set('irmaa-result', '');
    error('qcd-error', issue.message);
  }
  return { ...qcd, gift: gift.gift, giftDate: gift.giftDate };
}

function renderRmd(rmd, otherDistributions, qcd) {
  set('rmd-amount', rmd.amount === null ? 'Use Table II' : money.format(rmd.amount));
  set('rmd-divisor', rmd.divisor?.toFixed(1) ?? '—');
  set('rmd-deadline', rmd.deadline ? formatDate(rmd.deadline) : 'None');

  if (rmd.amount === null) {
    set('rmd-remaining', '—');
    set('rmd-note', 'Use the IRS Joint and Last Survivor Expectancy Table (Table II) for your 2026 divisor.');
    set('penalty-result', 'Calculate your RMD with Table II before estimating the excise tax.');
    return;
  }

  const timelyGift = rmd.deadline && qcd && qcd.giftDate <= rmd.deadline ? qcd : null;
  const qualified = calculatePenalty(rmd.amount, otherDistributions, timelyGift?.excluded ?? 0);
  const penalty = calculatePenalty(rmd.amount, otherDistributions, timelyGift?.gift ?? 0);
  set('rmd-remaining', money.format(penalty.shortfall));

  let note = `Age ${rmd.age} at year-end. `;
  if (rmd.firstYear === null) {
    note += 'Roth owners have no lifetime RMD.';
  } else if (rmd.firstYear > TAX_YEAR) {
    note += `Your first RMD is for ${rmd.firstYear}, at age ${rmd.startAge}, and is normally due April 1, ${rmd.firstYear + 1}.`;
  } else {
    note += `Your applicable starting age is ${rmd.startAge === 70.5 ? '70½' : rmd.startAge}. `;
    if (rmd.firstYear === TAX_YEAR) {
      note += 'If you delay your first RMD until 2027, you will have two RMDs in 2027. The second is due December 31, 2027. ';
    }
    if (timelyGift?.gift > 0) {
      note += `The proposed gift is assumed withdrawn by the deadline. Of the gift, ${money.format(qualified.qcdApplied)} of QCD and ${money.format(penalty.qcdApplied - qualified.qcdApplied)} of taxable withdrawal count toward this RMD.`;
    }
  }

  if (rmd.deadline && qcd === null && element('account-type').value === 'ira') {
    note += 'The estimate uses other distributions only until the gift inputs are complete.';
  }
  set('rmd-note', note.trim());
  set('penalty-result', penalty.shortfall > 0
    ? `If ${money.format(penalty.shortfall)} is still unpaid at the deadline, the excise tax is ${money.format(penalty.standard)}, or ${money.format(penalty.corrected)} with qualifying correction.`
    : 'With the payments entered, the 2026 RMD shortfall and related excise tax are both $0.');
}

function renderProjection(account) {
  const rows = element('projection-rows');
  rows.replaceChildren();
  error('projection-error', '');
  if (!account) return;

  try {
    const projection = projectRmd(account, field('growth'));
    for (const row of projection) {
      const tr = rows.insertRow();
      for (const value of [
        row.year, row.age, row.divisor?.toFixed(1) ?? '—',
        row.amount === null ? 'Use Table II' : money.format(row.amount),
        row.endingBalance === null ? '—' : money.format(row.endingBalance),
      ]) {
        tr.insertCell().textContent = value;
      }
    }
    if (projection.at(-1)?.amount === null) {
      error('projection-error', 'The projection stops at the first year that requires an IRS Table II divisor.');
    }
  } catch (issue) {
    error('projection-error', issue.message);
  }
}

function render() {
  const accountType = field('account-type');
  const qcd = renderQcd(accountType);
  let account;
  try {
    account = {
      accountType, birthDate: field('birth-date'), balance: field('balance'),
      jointTable: element('joint-table').checked,
    };
    const rmd = rmdForYear(account, TAX_YEAR);
    renderRmd(rmd, field('distributed'), qcd);
    error('rmd-error', '');
  } catch (issue) {
    rmdFields.forEach((id) => set(id, '—'));
    set('rmd-note', '');
    set('penalty-result', 'Complete the RMD inputs to estimate the excise tax.');
    error('rmd-error', issue.message);
  }
  renderProjection(account);
}

for (const form of [rmdForm, qcdForm]) {
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', render);
}
growth.addEventListener('input', render);
render();

// Manual ads require inventory belonging to the configured publisher.
for (const unit of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(unit.dataset.adSlot)) (window.adsbygoogle ||= []).push({});
}
