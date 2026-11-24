import { calculate } from './model.mjs';

const get = id => document.getElementById(id);
const form = get('qcd-form');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const write = (id, value) => {
  get(id).textContent = value;
};

function readNumber(id) {
  const field = get(id);
  if (!Number.isFinite(field.valueAsNumber) || !field.validity.valid) {
    const label = field.labels[0].textContent.trim();
    throw new RangeError('Enter a valid number for “' + label + '”.');
  }
  return field.valueAsNumber;
}

function readOwner(prefix) {
  return {
    age: readNumber(prefix + '-age'),
    rmd: readNumber(prefix + '-rmd'),
    alreadyTaken: readNumber(prefix + '-taken'),
    gift: readNumber(prefix + '-gift'),
    offset: readNumber(prefix + '-offset'),
    split: readNumber(prefix + '-split'),
    splitUsed: get(prefix + '-split-used').checked,
  };
}

function update() {
  const status = get('status').value;
  const method = get('method').value;
  const joint = status === 'joint';
  const itemized = method === 'itemized';
  const otherItemizedField = get('other-itemized');
  get('spouse-fields').hidden = !joint;
  get('spouse-fields').disabled = !joint;
  get('joint-rmd').hidden = !joint;
  get('itemized-fields').hidden = !itemized;
  otherItemizedField.disabled = !itemized;

  for (const id of ['seniors', 'part-b', 'part-d']) {
    const select = get(id);
    if (!joint && select.value === '2') select.value = '1';
    select.options[2].disabled = !joint;
  }

  const error = get('form-error');
  const results = get('results');
  try {
    const donors = [readOwner('owner')];
    if (joint) donors.push(readOwner('spouse'));
    const otherItemized = itemized ? readNumber('other-itemized') : 0;
    const result = calculate({
      status, method, donors, otherItemized,
      otherAgi: readNumber('other-agi'),
      exemptInterest: readNumber('exempt-interest'),
      seniorCount: Number(get('seniors').value),
      partB: Number(get('part-b').value),
      partD: Number(get('part-d').value),
    });

    for (const [id, value] of Object.entries({
      'total-saved': result.totalSaved,
      'federal-saved': result.federalSaved,
      'irmaa-saved': result.irmaaSaved,
      'qcd-excluded': result.qcdExcluded,
      'remaining-rmd': result.remainingRmd,
      'rmd-covered': result.rmdCovered,
      haircut: result.haircutAvoided,
      fallback: result.cashFallback,
    })) write(id, money.format(value));

    if (joint) {
      const [owner, spouse] = result.donors;
      write('rmd-by-filer', 'You ' + money.format(owner.remainingRmd)
        + ' · Spouse ' + money.format(spouse.remainingRmd));
    }

    for (const [key, scenario] of [['cash', result.cash], ['qcd', result.qcd]]) {
      for (const field of ['agi', 'charity', 'senior', 'tax', 'magi']) {
        write(key + '-' + field, money.format(scenario[field]));
      }
      write(key + '-tier', scenario.irmaa.tier);
      write(key + '-irmaa', money.format(scenario.irmaa.annual));
    }

    get('offset-warning').hidden = !donors.some(owner => owner.offset > 0);
    write('offset-warning', 'Deductible IRA contribution offset: '
      + money.format(result.taxableTransfer)
      + ' of direct IRA transfers is included in taxable income in this estimate.');
    const hasSplit = donors.some(owner => owner.split > 0);
    get('split-warning').hidden = !hasSplit;
    get('split-result').hidden = !hasSplit;
    write('split-funded', money.format(result.donors.reduce((total, owner) => total + owner.split, 0)));
    get('itemized-warning').hidden = !itemized || ![result.cash, result.qcd].some(scenario =>
      otherItemized + scenario.charity - scenario.section68 < result.standardDeduction);

    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.hidden = false;
    error.textContent = problem.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
