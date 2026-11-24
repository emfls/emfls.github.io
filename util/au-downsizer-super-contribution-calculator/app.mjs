import {downsize, parseCents} from './model.mjs';

const aud = new Intl.NumberFormat('en-AU', {style:'currency', currency:'AUD', currencyDisplay:'code'});
const currency = cents => aud.format(cents / 100);

export function summarize(form) {
  const cents = name => parseCents(form.get(name));
  const member = n => ({
    age:Number(form.get('age' + n)), prior:form.has('prior' + n), wanted:cents('wanted' + n),
    eligiblePhase:form.has('phase' + n), cap:cents('cap' + n), used:cents('used' + n),
  });
  const people = form.get('household') === 'couple' ? [member(1), member(2)] : [member(1)];
  const r = downsize({
    owned:Number(form.get('owned')), days:Number(form.get('days')), australian:form.has('australian'),
    cgt:form.has('cgt'), proceeds:cents('proceeds'), otherAssets:cents('otherAssets'),
    beforeAssessable:cents('beforeAssessable'), homeowner:form.has('homeowner'), people,
  });
  const rows = [['Total eligible planned downsizer contribution', currency(r.total)]];
  for (const [i, m] of r.members.entries()) {
    const prefix = 'Member ' + (i + 1) + ' · ';
    rows.push(
      [prefix + 'eligibility', m.reasons.length ? m.reasons.join(', ') : 'Meets the modeled requirements'],
      [prefix + 'maximum at this allocation order', currency(m.maximum)],
      [prefix + 'eligible planned contribution', currency(m.contribution)],
      [prefix + 'available for retirement phase / remaining in accumulation', currency(m.pension) + ' / ' + currency(m.accumulation)],
      [prefix + 'assessable part of new super', currency(m.assessable)],
    );
  }
  rows.push(
    ['Full-rate assets threshold / part-pension cut-off', currency(r.before.full) + ' / ' + currency(r.before.cutoff)],
    ['Assessable assets before / after transfer', currency(r.before.assets) + ' / ' + currency(r.after.assets)],
    ['Potentially age-eligible household members', String(r.eligible)],
  );
  if (r.eligible) {
    rows.push(
      ['Assets-test reduction per fortnight · before / after', currency(r.before.reduction) + ' / ' + currency(r.after.reduction)],
      ['Annualised assets-test reduction · before / after', currency(r.before.annualReduction) + ' / ' + currency(r.after.annualReduction)],
      ['Pension estimate per fortnight under the assets test · before / after', currency(r.before.payment) + ' / ' + currency(r.after.payment)],
    );
  } else {
    rows.push(['Pension estimate', 'No household member has reached Age Pension age.']);
  }
  return {rows};
}

function updateFields(form) {
  const partner = form.querySelector('#member-two');
  partner.hidden = form.elements.household.value !== 'couple';
  partner.disabled = partner.hidden;
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#calculator');
  const result = document.querySelector('#result');
  const hint = result.textContent.trim();
  updateFields(form);
  form.addEventListener('input', () => {
    updateFields(form);
    result.textContent = hint;
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const {rows} = summarize(new FormData(form));
      const list = document.createElement('dl');
      for (const [label, value] of rows) {
        const term = document.createElement('dt');
        const definition = document.createElement('dd');
        term.textContent = label;
        definition.textContent = value;
        list.append(term, definition);
      }
      result.replaceChildren(list);
    } catch (error) {
      result.textContent = error instanceof RangeError ? error.message : 'Check the inputs and try again.';
    }
  });
  form.querySelector('button[type=submit]').disabled = false;
}
