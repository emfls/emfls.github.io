import { evaluateResidence, meetsUKHomeTest, meetsUKWorkTest } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('srt-form');
const resultPanel = byId('srt-result');
const errorMessage = byId('input-error');
const riskBox = byId('risk-box');
const warning = byId('buffer-warning');
const matrixRows = [...document.querySelectorAll('[data-last-day]')];
const checked = id => byId(id).checked;
const dayCount = id => byId(id).valueAsNumber;

const stepNames = {
  AUTOMATIC_OVERSEAS: 'Automatic overseas test',
  AUTOMATIC_UK: 'Automatic UK test',
  SUFFICIENT_TIES: 'Sufficient ties test'
};
const explanations = {
  UK_183_DAYS: '183 or more countable UK days.',
  OVERSEAS_LEAVER: 'Fewer than 16 UK days after residence in at least one of the prior three years.',
  OVERSEAS_ARRIVER: 'Fewer than 46 UK days after three years of non-residence.',
  OVERSEAS_WORK: 'Qualifying full-time overseas work, under 91 UK days for this test and under 31 UK workdays.',
  UK_HOME: 'The qualifying UK home test is met.',
  UK_WORK: 'The qualifying full-time UK work test is met.',
  ENOUGH_TIES: 'Your tie count meets the threshold for this day band.',
  TOO_FEW_TIES: 'Your tie count is below the threshold for this day band.'
};
const tieNames = {
  family: 'Family', accommodation: 'Accommodation', work: 'Work',
  prior90: '90-day', country: 'Country'
};

function render() {
  const previouslyResident = byId('history').value === 'leaver';
  const overseasWork = checked('overseas-work');
  const homePeriod = checked('uk-home');
  const workPeriod = checked('uk-work');
  const overseasField = byId('overseas-days');
  byId('country-field').hidden = !previouslyResident;
  byId('overseas-count').hidden = !overseasWork;
  byId('uk-home-counts').hidden = !homePeriod;
  byId('uk-work-counts').hidden = !workPeriod;

  for (const cell of document.querySelectorAll('.srt-table [aria-current]')) {
    cell.removeAttribute('aria-current');
  }

  const ukDays = dayCount('uk-days');
  const ukWorkdays = dayCount('workdays');
  let result;
  try {
    result = evaluateResidence({
      previouslyResident, ukDays, overseasWork,
      overseasUkDays: overseasWork && (overseasField.value !== '' || overseasField.validity.badInput)
        ? overseasField.valueAsNumber : undefined,
      ukWorkdays, priorDays1: dayCount('prior-one'), priorDays2: dayCount('prior-two'),
      family: checked('family'), accommodation: checked('accommodation'), country: checked('country'),
      ukHome: homePeriod && meetsUKHomeTest(dayCount('uk-home-days'), dayCount('overseas-home-days')),
      ukWork: workPeriod && meetsUKWorkTest(dayCount('period-uk-workdays'), dayCount('period-workdays'), ukWorkdays)
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    resultPanel.hidden = true;
    warning.hidden = true;
    riskBox.removeAttribute('data-risk');
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
    return;
  }

  errorMessage.hidden = true;
  errorMessage.textContent = '';
  resultPanel.hidden = false;
  resultPanel.dataset.verdict = result.verdict;
  byId('verdict').textContent = result.verdict === 'UK_TAX_RESIDENT' ? 'UK tax resident' : 'Non-UK resident';
  byId('deciding-test').textContent = `${stepNames[result.step]} · ${explanations[result.test]}`;
  byId('active-ties').textContent = `${result.activeTies} / ${result.tieLimit}`;
  byId('max-days').textContent = result.maxSafeDays;
  const remaining = result.remainingDays;
  byId('remaining-days').textContent = remaining < 0 ? `−${Math.abs(remaining)}` : remaining;
  const activeNames = Object.keys(result.ties).filter(tie => result.ties[tie]).map(tie => tieNames[tie]);
  byId('tie-summary').textContent = activeNames.length ? `Active ties · ${activeNames.join(', ')}` : 'No active UK ties.';
  byId('ties-only').textContent = `Day limit from the ties and short-stay thresholds alone · ${result.tiesOnlyMaxDays}`;

  const row = matrixRows.find(row => ukDays <= Number(row.dataset.lastDay));
  row.cells[previouslyResident ? 2 : 1].setAttribute('aria-current', 'true');

  riskBox.dataset.risk = String(remaining <= 0);
  warning.hidden = remaining > 0;
  warning.textContent = remaining === 0
    ? 'You have reached the estimated non-residence limit.'
    : 'Your UK day count exceeds the estimated non-residence limit.';
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
