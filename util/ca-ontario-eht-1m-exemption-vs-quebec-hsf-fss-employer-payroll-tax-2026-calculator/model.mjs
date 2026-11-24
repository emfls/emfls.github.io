export const MAX_PAYROLL = 1_000_000_000_000;
export const ONTARIO_CLIFF = 5_000_000;
export const BC_BANDS = Object.freeze({
  regular: Object.freeze({ exemption: 1_000_000, ceiling: 1_500_000, rate: 5.85 }),
  nonprofit: Object.freeze({ exemption: 1_500_000, ceiling: 4_500_000, rate: 2.925 })
});

const ONTARIO_RATES = [
  [200_000, 980n], [230_000, 1101n], [260_000, 1223n], [290_000, 1344n],
  [320_000, 1465n], [350_000, 1586n], [380_000, 1708n], [400_000, 1829n],
  [Infinity, 1950n]
];

function payrollCents(amount) {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_PAYROLL || cents / 100 !== amount) {
    throw new RangeError('Enter a non-negative payroll amount in dollars and cents within the calculator limit.');
  }
  return cents;
}

function validateChoice(value, choices) {
  if (!choices.includes(value)) throw new RangeError('Unknown employer classification.');
}

function taxDollars(cents, numerator, denominator = 100_000n) {
  // Round to the nearest cent, with exact halves rounded up.
  return Number((BigInt(cents) * numerator + denominator / 2n) / denominator) / 100;
}

export function ontarioEht(payroll, employer = 'eligible') {
  const cents = payrollCents(payroll);
  validateChoice(employer, ['eligible', 'ineligible', 'charity']);
  const getsExemption = employer === 'charity' || (employer === 'eligible' && payroll <= ONTARIO_CLIFF);
  const taxable = Math.max(0, cents - (getsExemption ? 100_000_000 : 0));
  const [, rate] = ONTARIO_RATES.find(([limit]) => payroll <= limit);
  return taxDollars(taxable, rate);
}

export function quebecHsf(payroll, employer = 'general') {
  const cents = payrollCents(payroll);
  validateChoice(employer, ['general', 'primary']);
  const primary = employer === 'primary';
  if (payroll <= 1_000_000) return taxDollars(cents, primary ? 1250n : 1650n);
  if (payroll >= 7_800_000) return taxDollars(cents, 4260n);

  // The published rate is in percent and uses payroll in millions of dollars.
  // Keep the formula at full precision until rounding the final liability.
  const [base, slope] = primary ? [8074n, 4426n] : [12662n, 3838n];
  const millionDollarsInCents = 100_000_000n;
  return taxDollars(
    cents,
    base * millionDollarsInCents + slope * BigInt(cents),
    1_000_000n * millionDollarsInCents
  );
}

export function bcEht(payroll, employer = 'regular') {
  const cents = payrollCents(payroll);
  validateChoice(employer, ['regular', 'nonprofit']);
  const { exemption, ceiling, rate } = BC_BANDS[employer];
  if (payroll > ceiling) return taxDollars(cents, 1950n);
  return taxDollars(Math.max(0, cents - exemption * 100), BigInt(Math.round(rate * 1000)));
}

export function comparePayroll(currentPayroll, addedPayroll, {
  ontario = 'eligible', quebec = 'general', bc = 'regular'
} = {}) {
  const projectedPayroll = (payrollCents(currentPayroll) + payrollCents(addedPayroll)) / 100;
  const scenarios = [
    ['AB', 'Alberta', () => 0],
    ['ON', 'Ontario', payroll => ontarioEht(payroll, ontario)],
    ['BC', 'British Columbia', payroll => bcEht(payroll, bc)],
    ['QC', 'Québec', payroll => quebecHsf(payroll, quebec)]
  ];
  const difference = (after, before) => (Math.round(after * 100) - Math.round(before * 100)) / 100;
  const rows = scenarios.map(([code, province, estimate]) => {
    const annualTax = estimate(projectedPayroll);
    return {
      code, province, annualTax,
      effectiveRate: projectedPayroll === 0 ? 0 : 100 * annualTax / projectedPayroll,
      hiringTax: difference(annualTax, estimate(currentPayroll))
    };
  }).sort((left, right) => left.annualTax - right.annualTax);
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    row.rank = previous?.annualTax === row.annualTax ? previous.rank : index + 1;
  });

  const [alberta, ontarioRow, quebecRow] = ['AB', 'ON', 'QC'].map(code => rows.find(row => row.code === code));
  return {
    projectedPayroll, rows,
    crossesOntarioCliff: ontario === 'eligible' && currentPayroll <= ONTARIO_CLIFF && projectedPayroll > ONTARIO_CLIFF,
    annualSavings: {
      ON: difference(quebecRow.annualTax, ontarioRow.annualTax),
      AB: difference(quebecRow.annualTax, alberta.annualTax)
    },
    hiringSavings: {
      ON: difference(quebecRow.hiringTax, ontarioRow.hiringTax),
      AB: difference(quebecRow.hiringTax, alberta.hiringTax)
    }
  };
}
