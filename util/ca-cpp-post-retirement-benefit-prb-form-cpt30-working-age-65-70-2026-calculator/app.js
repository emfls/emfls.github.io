import { projectPrb } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('prb-form');
const error = byId('error');
const results = byId('results');
const decision = byId('decision');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const money = amount => currency.format(Math.abs(amount) < 0.005 ? 0 : amount);

const statuses = {
  MANDATORY_60_64: 'Required at ages 60–64',
  OPTIONAL_CPT30_ELIGIBLE: 'Opt-out eligible at ages 65–69',
  STOPPED_70_PLUS: 'Automatic stop at age 70',
};

const decisions = {
  KEEP_CONTRIBUTING_FOR_PRB: 'Keeping CPP contributions has the higher or equal modeled value.',
  FILE_FORM_CPT30_OPT_OUT: 'Opting out via Form CPT30 and investing the savings has the higher modeled value.',
  FILE_SCHEDULE_8_OPT_OUT: 'Electing to opt out on Schedule 8 and investing the savings has the higher modeled value.',
  NO_CONTRIBUTIONS_AT_70: 'No new CPP contributions or PRB accrual are projected at age 70. Existing benefits continue.',
  NO_CONTRIBUTION_AT_THIS_INCOME: 'These earnings produce no CPP contribution or new PRB in the model.',
};

function describeBreakEven(value, age, lifeAge, hasChoice) {
  if (!hasChoice) return 'No optional costs';
  if (value === null) return `Beyond age ${lifeAge}`;
  const months = Math.round(value * 12);
  const elapsed = months - age * 12;
  const ageLabel = `${Math.floor(months / 12)} years, ${months % 12} months`;
  return `${ageLabel} (${elapsed} months from start)`;
}

function describeDecision(model) {
  if (model.status !== 'MANDATORY_60_64' || model.contribution.gross === 0) {
    return decisions[model.recommendation];
  }
  if (model.optionalYears === 0) {
    return 'Continue contributing. All projected work years fall before opt-out eligibility.';
  }
  return `Continue contributing until age 65. From age 65, ${decisions[model.recommendation].replace(/^./, char => char.toLowerCase())}`;
}

function update() {
  const number = id => byId(id).valueAsNumber;
  const age = number('age');
  const lifeAge = number('life-age');
  let model;
  try {
    model = projectPrb({
      age,
      employmentType: byId('employment').value,
      earnings: number('earnings'),
      workYears: number('work-years'),
      taxPercent: number('tax-rate'),
      returnPercent: number('return-rate'),
      lifeAge,
      gis: byId('gis').value === 'yes',
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    decision.hidden = true;
    results.hidden = true;
    return;
  }

  error.hidden = true;
  decision.textContent = describeDecision(model);
  decision.hidden = false;
  results.hidden = false;
  const hasChoice = model.optionalYears > 0 && model.contribution.net > 0;
  const firstPrb = model.years[0]?.monthlyGrossPrb ?? 0;
  const outputs = {
    status: statuses[model.status],
    gross: money(model.contribution.gross),
    net: money(model.contribution.net),
    'first-prb': `${money(firstPrb)} / mo · ${money(firstPrb * 12)} / yr`,
    simple: describeBreakEven(model.simpleBreakEvenAge, age, lifeAge, hasChoice),
    pv: describeBreakEven(model.pvBreakEvenAge, age, lifeAge, hasChoice),
    'lifetime-all': money(model.lifetimeNetPrbAllYears),
    'lifetime-optional': money(model.lifetimeNetPrb),
    investment: money(model.investmentValue),
    'prb-future': money(model.prbFutureValue),
    advantage: money(model.pvAdvantage),
  };
  for (const [id, value] of Object.entries(outputs)) byId(id).textContent = value;

  byId('comparison-note').textContent = hasChoice
    ? `The comparison uses ${model.optionalYears} optional work ${model.optionalYears === 1 ? 'year' : 'years'}. Mandatory CPP and its PRB apply to both choices.`
    : 'There are no optional contribution costs to compare in this scenario.';
  byId('accrual-wrap').hidden = model.years.length === 0;
  byId('accrual').replaceChildren(...model.years.map(year => {
    const row = document.createElement('tr');
    const workAge = document.createElement('th');
    workAge.scope = 'row';
    workAge.textContent = year.workAge;
    row.append(workAge);
    for (const value of [year.prbStartAge, money(year.monthlyGrossPrb), money(year.monthlyGrossPrb * 12)]) {
      row.insertCell().textContent = value;
    }
    return row;
  }));
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
