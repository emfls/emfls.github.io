export const TAX = Object.freeze({
  allowance: 12570,
  taperStart: 100000,
  additionalStart: 125140,
  basicBand: 37700,
  dividendAllowance: 500,
  dividendRates: Object.freeze([0.1075, 0.3575, 0.3935]),
  exemption: 3000,
  badrRate: 0.18,
  higherCgtRate: 0.24,
  currentCap: 1000000,
  announcedCap: 500000,
  vatRate: 0.20
});

const basicCeiling = TAX.allowance + TAX.basicBand;
const positive = amount => Math.max(0, amount);

export function personalAllowance(adjustedNetIncome) {
  return positive(TAX.allowance - positive(adjustedNetIncome - TAX.taperStart) / 2);
}

function bandTax(amount, [basic, higher, additional]) {
  return Math.min(amount, TAX.basicBand) * basic
    + positive(Math.min(amount, TAX.additionalStart) - TAX.basicBand) * higher
    + positive(amount - TAX.additionalStart) * additional;
}

const ordinaryRates = [0.20, 0.40, 0.45];

export function dividendTax(dividend, income) {
  const allowance = personalAllowance(income + dividend);
  const taxableOther = positive(income - allowance);
  const taxableTotal = positive(income + dividend - allowance);
  const dividendFloor = Math.min(taxableTotal, taxableOther + TAX.dividendAllowance);
  const directTax = bandTax(taxableTotal, TAX.dividendRates) - bandTax(dividendFloor, TAX.dividendRates);
  const otherTaxIncrease = bandTax(taxableOther, ordinaryRates)
    - bandTax(positive(income - personalAllowance(income)), ordinaryRates);
  return directTax + otherTaxIncrease;
}

function cgtLowerRateRoom(person, cap) {
  const basicRoom = positive(TAX.basicBand - positive(person.income - personalAllowance(person.income)));
  const reliefRoom = person.qualifies ? positive(cap - person.prior) : 0;
  // BADR gains occupy basic-rate band capacity before ordinary gains.
  return Math.max(basicRoom, reliefRoom);
}

export function capitalTax(distribution, person, cap) {
  const taxableGain = positive(distribution - person.basis - person.exempt);
  // Apply the exemption to the 24% slice first, then any remaining 18% gains.
  const higherGain = positive(taxableGain - cgtLowerRateRoom(person, cap));
  return (taxableGain - higherGain) * TAX.badrRate + higherGain * TAX.higherCgtRate;
}

function liquidation(cash, fee, people, cap) {
  const distribution = positive(cash - fee);
  const tax = people.reduce((sum, person) => sum + capitalTax(distribution / people.length, person, cap), 0);
  return { available: cash >= fee, distribution, tax, net: distribution - tax };
}

function totalDividendTax(amount, people) {
  return people.reduce((sum, person) => sum + dividendTax(amount / people.length, person.income), 0);
}

function stagedDividends(cash, people) {
  const annualCapacity = Math.min(...people.map(person => positive(basicCeiling - person.income))) * people.length;
  if (cash === 0) return { available: true, annualCapacity, years: 0, tax: 0, net: 0 };
  if (annualCapacity === 0) return { available: false, annualCapacity, years: null, tax: null, net: null };

  const fullYears = Math.floor(cash / annualCapacity);
  const finalPayment = cash - fullYears * annualCapacity;
  const tax = fullYears * totalDividendTax(annualCapacity, people) + totalDividendTax(finalPayment, people);
  return { available: true, annualCapacity, years: fullYears + Number(finalPayment > 0.000001), tax, net: cash - tax };
}

function dividendBreakpoints(income) {
  const points = [TAX.dividendAllowance, TAX.taperStart - income, TAX.additionalStart - income];
  // Express total taxable income and taxable non-dividend income as affine
  // functions of dividend in each Personal Allowance regime.
  for (const [intercept, taper] of [[TAX.allowance, 0], [TAX.allowance + TAX.taperStart / 2 - income / 2, 0.5], [0, 0]]) {
    for (const band of [0, TAX.dividendAllowance, TAX.basicBand, TAX.additionalStart]) {
      points.push((band - income + intercept) / (1 + taper));
    }
    if (taper) {
      for (const band of [0, TAX.basicBand, TAX.additionalStart, TAX.basicBand - TAX.dividendAllowance,
        TAX.additionalStart - TAX.dividendAllowance]) {
        points.push((band - income + intercept) / taper);
      }
    }
  }
  // Extra points from an inactive regime simply subdivide a linear segment.
  return points;
}

function firstProfitableBalance(fee, people) {
  const count = people.length;
  const points = new Set([fee]);
  for (const person of people) {
    const exemptGain = person.basis + person.exempt;
    points.add(fee + count * exemptGain);
    points.add(fee + count * (exemptGain + cgtLowerRateRoom(person, TAX.currentCap)));
    for (const dividend of dividendBreakpoints(person.income)) {
      if (dividend * count > fee) points.add(dividend * count);
    }
  }
  const ordered = [...points].sort((a, b) => a - b);
  const advantage = cash => totalDividendTax(cash, people) - fee
    - liquidation(cash, fee, people, TAX.currentCap).tax;
  const last = ordered.at(-1);
  const lastValue = advantage(last);
  // After the final breakpoint, dividend tax increases at 39.35% and CGT at 24%.
  const finalSlope = TAX.dividendRates[2] - TAX.higherCgtRate;
  ordered.push(last + positive(-lastValue / finalSlope) + 1);

  let left = fee;
  let leftValue = advantage(left);
  for (const right of ordered) {
    const rightValue = advantage(right);
    if (leftValue > 1e-8 || rightValue > 1e-8) {
      const crossing = leftValue >= 0 ? left
        : left + (right - left) * (-leftValue / (rightValue - leftValue));
      const firstPenny = Math.max(Math.ceil(fee * 100 - 1e-6), Math.ceil(crossing * 100 - 1e-6));
      for (const penny of [firstPenny, firstPenny + 1]) {
        if (advantage(penny / 100) > 1e-8) return penny / 100;
      }
    }
    left = right;
    leftValue = rightValue;
  }
  return null;
}

export function compare({ cash, fee, vat = false, people }) {
  const badMoney = value => !Number.isFinite(value) || value < 0 || value > 100000000;
  if (!Array.isArray(people) || ![1, 2].includes(people.length) || badMoney(cash) || badMoney(fee)
      || people.some(person => [person.income, person.basis, person.prior, person.exempt].some(badMoney)
        || person.exempt > TAX.exemption || typeof person.qualifies !== 'boolean')) {
    throw new RangeError('Use one or two shareholders and amounts within the input limits.');
  }

  const totalFee = fee * (vat ? 1 + TAX.vatRate : 1);
  const mvl = liquidation(cash, totalFee, people, TAX.currentCap);
  const announced = liquidation(cash, totalFee, people, TAX.announcedCap);
  const lumpTax = totalDividendTax(cash, people);
  const netAdvantage = mvl.available ? lumpTax - mvl.tax - totalFee : null;
  return {
    fee: totalFee, mvl, announced,
    lump: { tax: lumpTax, net: cash - lumpTax },
    drip: stagedDividends(cash, people),
    taxSaved: mvl.available ? lumpTax - mvl.tax : null,
    savingsRate: mvl.available && cash > 0 ? (lumpTax - mvl.tax) / cash : null,
    netAdvantage,
    capExposure: mvl.available ? announced.tax - mvl.tax : null,
    breakeven: firstProfitableBalance(totalFee, people)
  };
}
