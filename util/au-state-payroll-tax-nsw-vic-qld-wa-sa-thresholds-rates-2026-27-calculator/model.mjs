export const states = Object.freeze(['NSW', 'VIC', 'QLD', 'WA', 'SA']);

const million = 1_000_000;
const deductions = Object.freeze({
  NSW: 1.2 * million,
  VIC: million,
  QLD: 1.3 * million,
  WA: million,
  SA: 600_000,
});

const above = (wages, threshold) => Math.max(0, wages - threshold);

function validateWages(wages) {
  if (!Number.isFinite(wages) || wages < 0 || wages > Number.MAX_SAFE_INTEGER / 100) {
    throw new RangeError('Enter a valid non-negative AUD wage amount.');
  }
}

export function calculateState(state, australianWages, stateWages = australianWages, regional = false) {
  if (!states.includes(state)) throw new RangeError('Select one of the five supported states.');
  validateWages(australianWages);
  validateWages(stateWages);
  if (stateWages > australianWages) throw new RangeError('State wages cannot exceed Australia-wide wages.');

  const share = australianWages ? stateWages / australianWages : 0;
  const maximum = deductions[state];
  let remaining = maximum;
  let rate;
  let mentalHealth = 0;
  let covidDebt = 0;

  switch (state) {
    case 'NSW':
      rate = 0.0545;
      break;
    case 'VIC':
      remaining -= above(australianWages, 3 * million) / 2;
      rate = regional ? 0.012125 : 0.0485;
      mentalHealth = share * (above(australianWages, 10 * million) + above(australianWages, 100 * million)) * 0.005;
      covidDebt = mentalHealth;
      break;
    case 'QLD':
      remaining -= above(australianWages, maximum) / 7;
      if (regional && stateWages <= 350 * million) {
        rate = australianWages <= 6.5 * million ? 0.0375 : 0.0395;
      } else {
        rate = australianWages <= 6.5 * million ? 0.0475 : 0.0495;
      }
      mentalHealth = share * (above(australianWages, 10 * million) * 0.0025
        + above(australianWages, 100 * million) * 0.005);
      break;
    case 'WA':
      remaining -= above(australianWages, maximum) * (2 / 13);
      rate = 0.055;
      break;
    case 'SA':
      rate = Math.min(1, above(australianWages, 1.5 * million) / 200_000) * 0.0495;
      break;
  }

  const nationalDeduction = Math.max(0, remaining);
  const deduction = nationalDeduction * share;
  const baseTax = above(australianWages, nationalDeduction) * share * rate;
  const annualTax = baseTax + mentalHealth + covidDebt;

  return {
    state, stateWages, rate, deduction, baseTax, mentalHealth, covidDebt, annualTax,
    deductionLost: (maximum - nationalDeduction) * share,
    monthlyTax: annualTax / 12,
    effectiveRate: stateWages ? annualTax / stateWages : 0,
  };
}

export function compareStates(australianWages, { allocations, regionalVic = false, regionalQld = false } = {}) {
  validateWages(australianWages);
  if (allocations) {
    // Compare integer cents so ordinary decimal input does not fail at an exact allocation.
    const allocatedCents = states.reduce((sum, state) => {
      const wages = allocations[state] ?? 0;
      validateWages(wages);
      return sum + Math.round(wages * 100);
    }, 0);
    if (allocatedCents > Math.round(australianWages * 100)) {
      throw new RangeError('The five state amounts together cannot exceed Australia-wide wages.');
    }
  }

  const rows = states.map(state => calculateState(
    state,
    australianWages,
    allocations ? (allocations[state] ?? 0) : australianWages,
    (state === 'VIC' && regionalVic) || (state === 'QLD' && regionalQld),
  )).sort((left, right) => left.annualTax - right.annualTax);

  return {
    rows,
    relocationDelta: allocations ? null : rows.at(-1).annualTax - rows[0].annualTax,
    combinedAnnualTax: allocations ? rows.reduce((total, row) => total + row.annualTax, 0) : null,
  };
}
