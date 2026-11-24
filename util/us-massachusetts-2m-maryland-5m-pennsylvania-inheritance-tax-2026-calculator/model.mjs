export const MAX_ESTATE = 1_000_000_000;

const MA_CREDIT = 99_600;
const MD_EXCLUSION = 5_000_000;
const PA_EARLY_DISCOUNT = 0.05;

// IRC § 2011 Table B: adjusted taxable estate floor, base credit, marginal rate.
const TABLE_B = [
  [10_040_000, 1_082_800, 0.16],
  [9_040_000, 930_800, 0.152],
  [8_040_000, 786_800, 0.144],
  [7_040_000, 650_800, 0.136],
  [6_040_000, 522_800, 0.128],
  [5_040_000, 402_800, 0.12],
  [4_040_000, 290_800, 0.112],
  [3_540_000, 238_800, 0.104],
  [3_040_000, 190_800, 0.096],
  [2_540_000, 146_800, 0.088],
  [2_040_000, 106_800, 0.08],
  [1_540_000, 70_800, 0.072],
  [1_040_000, 38_800, 0.064],
  [840_000, 27_600, 0.056],
  [640_000, 18_000, 0.048],
  [440_000, 10_000, 0.04],
  [240_000, 3600, 0.032],
  [140_000, 1200, 0.024],
  [90_000, 400, 0.016],
  [40_000, 0, 0.008],
];

const PA_RATES = {
  spouse: 0,
  lineal_child_parent: 0.045,
  sibling: 0.12,
  collateral_other: 0.15,
};

function dollars(amount) {
  // Compensate for binary floating-point error at half-cent boundaries.
  return Math.round((amount + amount * Number.EPSILON) * 100) / 100;
}

function requireRange(value, min, max, name) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`);
  }
}

function tableBCredit(estate) {
  const adjusted = estate - 60_000;
  const bracket = TABLE_B.find(([floor]) => adjusted >= floor);
  if (!bracket) return 0;

  const [floor, base, rate] = bracket;
  return base + (adjusted - floor) * rate;
}

export function gross2011Tax(estate) {
  requireRange(estate, 0, MAX_ESTATE, 'Net taxable estate');
  return dollars(tableBCredit(estate));
}

export function calculateDeathTaxes({
  estate, relationship, outsidePercent = 0, earlyPayment = false, paYoungChildTransfer = false,
}) {
  requireRange(estate, 0, MAX_ESTATE, 'Net taxable estate');
  requireRange(outsidePercent, 0, 100, 'Out-of-state property percentage');
  if (typeof relationship !== 'string' || !Object.hasOwn(PA_RATES, relationship)) {
    throw new RangeError('Choose a supported heir relationship.');
  }
  if (typeof earlyPayment !== 'boolean' || typeof paYoungChildTransfer !== 'boolean') {
    throw new RangeError('Payment and age options must be true or false.');
  }

  const inStateShare = (100 - outsidePercent) / 100;
  const inStateEstate = estate * inStateShare;
  const ma = { total: dollars(Math.max(0, tableBCredit(inStateEstate) - MA_CREDIT)) };

  // Under the no-gifts, no-portability assumptions, Schedule B's tentative
  // tax limit (40% of the excess) cannot bind before MET-1's 16% cap.
  const mdGross = dollars(Math.min(
    Math.max(0, estate - MD_EXCLUSION) * 0.16,
    tableBCredit(estate) * inStateShare,
  ));
  const mdInheritance = relationship === 'collateral_other' && inStateEstate > 1000
    ? dollars(inStateEstate * 0.10)
    : 0;
  const credit = Math.min(mdGross, mdInheritance);
  const netEstateTax = dollars(mdGross - credit);
  const comparisonEstateTax = dollars(
    Math.max(0, tableBCredit(estate) - tableBCredit(MD_EXCLUSION)) * inStateShare,
  );
  const md = {
    grossEstateTax: mdGross, inheritanceTax: mdInheritance, credit, netEstateTax,
    total: dollars(mdInheritance + netEstateTax),
    comparisonEstateTax, comparisonTotal: Math.max(comparisonEstateTax, mdInheritance),
  };

  const paExempt = relationship === 'lineal_child_parent' && paYoungChildTransfer;
  const grossTax = dollars(inStateEstate * (paExempt ? 0 : PA_RATES[relationship]));
  const potentialSavings = dollars(grossTax * PA_EARLY_DISCOUNT);
  const discount = earlyPayment ? potentialSavings : 0;
  const pa = { grossTax, potentialSavings, discount, total: dollars(grossTax - discount) };

  const ranked = [
    { code: 'MA', name: 'Massachusetts', total: ma.total },
    { code: 'MD', name: 'Maryland', total: md.total },
    { code: 'PA', name: 'Pennsylvania', total: pa.total },
  ].sort((left, right) => left.total - right.total);
  for (const [index, row] of ranked.entries()) {
    row.rank = index > 0 && row.total === ranked[index - 1].total ? ranked[index - 1].rank : index + 1;
    row.effectiveRate = estate === 0 ? 0 : row.total / estate;
  }
  return { ma, md, pa, ranked };
}

export function relationshipMatrix(estate, options = {}) {
  return Object.keys(PA_RATES).map(relationship => ({
    relationship,
    ...calculateDeathTaxes({ ...options, estate, relationship }),
  }));
}
