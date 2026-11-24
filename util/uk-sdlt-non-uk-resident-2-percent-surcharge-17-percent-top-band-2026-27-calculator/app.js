import { calculateSdlt, parsePresence, trackPresence } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const whole = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const precise = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 4,
});
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});
const displayDate = iso => dateFormat.format(new Date(iso + 'T00:00:00Z'));
const write = (id, value) => { byId(id).textContent = value; };

function readPrice(value) {
  const match = /^(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError('Enter a purchase price such as 450000 or 450,000.50.');
  return Number(match[1].replaceAll(',', '')) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

function trackerMessage(tax, tracker) {
  if (!tracker) return 'The 183-day repayment route applies to individual buyers.';
  if (!tracker.completionAssessed) return 'Completion estimate based on dates entered so far. Recheck through the effective date.';
  if (!tax.overseas) return 'The 2% surcharge is zero in this scenario.';
  if (tracker.deadlinePassed) return 'The two-year claim deadline has passed as of the assessment date.';
  if (tracker.qualifiedOn) return 'The dates entered meet the test on ' + displayDate(tracker.qualifiedOn) + '. If the surcharge was paid, apply to HMRC by the claim deadline.';
  if (tracker.windowClosed) return 'The presence window has closed. The dates entered fall short of the test.';
  return 'The dates entered fall short of the test. Check each buyer’s best rolling count below.';
}

function render(tax, tracker, purchase) {
  write('total', whole.format(tax.total));
  write('effective-rate', tax.effectiveRate.toFixed(2) + '% effective rate');
  write('base-label', tax.corporateFlat ? 'Flat corporate SDLT (17%)' : 'Base SDLT');
  for (const id of ['base', 'additional', 'overseas']) write(id, whole.format(tax[id]));
  const eligible = tracker?.completionAssessed && tracker.qualifiedOn && !tracker.deadlinePassed;
  write('potential', tracker ? whole.format(tax.overseas) : 'Individual buyers only');
  write('eligible', tracker ? whole.format(eligible ? tax.overseas : 0) : 'Individual buyers only');
  write('scenario', purchase === 'first-home' && !tax.firstHome
    ? 'The price exceeds £500,000, so the standard bands apply to the full price.' : '');

  byId('replacement-row').hidden = purchase !== 'replacement';
  write('replacement', whole.format(tax.replacementRefund));
  byId('combined').hidden = !tax.replacementRefund || !tax.overseas;
  write('combined', 'If both refunds qualify, the total overpayment is ' + whole.format(tax.combinedRefund) + '.');
  write('tracker-status', trackerMessage(tax, tracker));
  write('tracker-dates', tracker
    ? 'Presence window: ' + displayDate(tracker.firstDay) + ' to ' + displayDate(tracker.lastDay)
      + '. 2% claim deadline: ' + displayDate(tracker.claimDeadline) + '.' : '');
  byId('buyer-stats').replaceChildren(...(tracker?.counts ?? []).map((count, index) => {
    const item = document.createElement('li');
    const initialLabel = tracker.completionAssessed ? 'by the effective date' : 'toward the completion test';
    item.textContent = 'Buyer ' + (index + 1) + ': ' + count.initial + ' UK days ' + initialLabel
      + ', best rolling count ' + count.best + ' of 183 required days.';
    return item;
  }));

  byId('bands').replaceChildren(...tax.rows.map(band => {
    const row = document.createElement('tr');
    const lower = whole.format(band.lowerPence / 100);
    const upper = whole.format(band.upperPence / 100);
    const label = tax.corporateFlat ? 'Full price' : band.upperPence === Infinity
      ? 'Over ' + lower : band.lowerPence === 0 ? 'Up to ' + upper : 'Over ' + lower + ' to ' + upper;
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    row.append(heading);
    for (const value of [precise.format(band.slicePence / 100), band.rate + '%', precise.format(band.tax)]) {
      row.insertCell().textContent = value;
    }
    return row;
  }));
}

function update() {
  const purchase = byId('purchase').value;
  const company = purchase === 'company' || purchase === 'company-relief';
  byId('company-field').hidden = !company;
  byId('presence-field').hidden = company;
  byId('as-of-field').hidden = company;
  try {
    const effective = byId('effective');
    if (!effective.validity.valid) throw new RangeError('Choose an effective date from 6 April 2026 to 5 April 2027.');
    const tracker = company ? null : trackPresence({
      effectiveDate: effective.value,
      asOfDate: byId('as-of').value,
      buyers: parsePresence(byId('presence').value),
      spousePair: byId('spouses').checked,
    });
    const tax = calculateSdlt({
      pricePence: readPrice(byId('price').value),
      purchase,
      nonResident: company ? byId('company-residency').value === 'overseas' : tracker.nonResident,
    });
    render(tax, tracker, purchase);
    byId('results').hidden = false;
    byId('error').hidden = true;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    byId('results').hidden = true;
    write('error', error.message);
    byId('error').hidden = false;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
