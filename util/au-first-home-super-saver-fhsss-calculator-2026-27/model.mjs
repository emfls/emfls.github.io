export const FHSS_RULES = Object.freeze({
  annualCap: 15000,
  lifetimeCap: 50000,
  concessionalCap: 32500,
  concessionalRelease: 0.85,
  offset: 0.30
});

const { annualCap, lifetimeCap, concessionalCap, concessionalRelease, offset } = FHSS_RULES;
const dayMs = 86400000;

function inRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function monthlyAmounts(cents, month) {
  return Math.floor(cents * (month + 1) / 12) - Math.floor(cents * month / 12);
}

// The scenario starts on 1 July 2026 and ends with a determination on 30 June.
function deemedGrowth(years, sic) {
  const growth = [];
  let logGrowth = 0;
  for (let month = years * 12 - 1; month >= 0; month--) {
    const start = Date.UTC(2026, 6 + month, 1);
    const end = Date.UTC(2026, 7 + month, 1);
    const calendarYear = new Date(start).getUTCFullYear();
    const daysInYear = (Date.UTC(calendarYear + 1, 0, 1) - Date.UTC(calendarYear, 0, 1)) / dayMs;
    logGrowth += (end - start) / dayMs * Math.log1p(sic / 100 / daysInYear);
    growth[month] = Math.expm1(logGrowth);
  }
  return growth;
}

function projectBuyer(buyer, years, growth, bankRate) {
  const { gross, concessionalShare, savingsTax, releaseTax, medicare, otherConcessional, priorEligible } = buyer ?? {};
  if (!inRange(gross, 0, 1000000) || !inRange(concessionalShare, 0, 100)
    || !inRange(savingsTax, 0, 45) || !inRange(releaseTax, 0, 45) || !inRange(medicare, 0, 2)
    || !inRange(otherConcessional, 0, 1000000) || !inRange(priorEligible, 0, lifetimeCap)) {
    throw new RangeError('Buyer inputs are outside the supported ranges.');
  }

  const takeHome = (100 - savingsTax - medicare) / 100;
  const releaseTaxRate = Math.max(0, releaseTax + medicare - offset * 100) / 100;
  const bankGrowth = 1 + bankRate / 1200 * takeHome;
  const grossCents = Math.round(gross * 100);
  const plannedBeforeTax = Math.round(grossCents * concessionalShare / 100);
  const plannedAfterTaxGross = grossCents - plannedBeforeTax;
  const plannedAfterTax = Math.floor(plannedAfterTaxGross * takeHome + 1e-8);
  const otherCents = Math.round(otherConcessional * 100);
  const headroom = Math.max(0, concessionalCap * 100 - otherCents);
  let lifetimeRemaining = lifetimeCap * 100 - Math.round(priorEligible * 100);
  let concessionalCents = 0;
  let nonConcessionalCents = 0;
  let associatedEarnings = 0;
  let bankDeposit = 0;
  let overflowDeposit = 0;
  const annual = [];

  for (let year = 0; year < years; year++) {
    let yearConcessional = 0;
    let yearNonConcessional = 0;
    let fhssRemaining = Math.min(annualCap * 100, lifetimeRemaining);
    for (let month = 0; month < 12; month++) {
      const beforeTax = monthlyAmounts(plannedBeforeTax, month);
      const afterTax = monthlyAmounts(plannedAfterTax, month);

      // For same-day contributions, use after-tax contributions first.
      const nonConcessional = Math.min(afterTax, fhssRemaining);
      const concessional = Math.min(beforeTax, fhssRemaining - nonConcessional, headroom - yearConcessional);
      fhssRemaining -= concessional + nonConcessional;
      yearConcessional += concessional;
      yearNonConcessional += nonConcessional;

      const growthFactor = growth[year * 12 + month];
      associatedEarnings += Math.floor(concessional / 100 * concessionalRelease * growthFactor)
        + Math.floor(nonConcessional / 100 * growthFactor);
      const bankCash = (beforeTax * takeHome + afterTax) / 100;
      const unusedCash = ((beforeTax - concessional) * takeHome + afterTax - nonConcessional) / 100;
      bankDeposit = (bankDeposit + bankCash) * bankGrowth;
      overflowDeposit = (overflowDeposit + unusedCash) * bankGrowth;
    }
    const yearTotal = yearConcessional + yearNonConcessional;
    lifetimeRemaining -= yearTotal;
    concessionalCents += yearConcessional;
    nonConcessionalCents += yearNonConcessional;
    annual.push({
      eligibleConcessional: yearConcessional / 100,
      eligibleNonConcessional: yearNonConcessional / 100,
      concessionalCapLimited: otherCents + plannedBeforeTax > concessionalCap * 100
    });
  }

  const eligibleConcessional = concessionalCents / 100;
  const eligibleNonConcessional = nonConcessionalCents / 100;
  const releasableConcessional = eligibleConcessional * concessionalRelease;
  const releasePrincipal = releasableConcessional + eligibleNonConcessional;
  const assessableRelease = releasableConcessional + associatedEarnings;
  const releaseTaxAmount = assessableRelease * releaseTaxRate;
  const netRelease = releasePrincipal + associatedEarnings - releaseTaxAmount;
  const fhssDeposit = netRelease + overflowDeposit;
  return {
    eligibleConcessional, eligibleNonConcessional, releasePrincipal, associatedEarnings, assessableRelease,
    releaseTax: releaseTaxAmount, releaseTaxRate, netRelease, overflowDeposit, bankDeposit, fhssDeposit,
    boost: fhssDeposit - bankDeposit, annual
  };
}

/** Inputs use AUD and percentage points. Each buyer has their own caps and tax rates. */
export function calculateFhss({ buyers, years, sic, bankRate } = {}) {
  if (!Array.isArray(buyers) || buyers.length < 1 || buyers.length > 2 || !Number.isInteger(years)
    || !inRange(years, 1, 4) || !inRange(sic, 0, 25) || !inRange(bankRate, 0, 25)) {
    throw new RangeError('Choose one or two buyers, 1–4 years and rates from 0% to 25%.');
  }
  const growth = deemedGrowth(years, sic);
  const projections = buyers.map(buyer => projectBuyer(buyer, years, growth, bankRate));
  const totals = {};
  for (const key of [
    'eligibleConcessional', 'eligibleNonConcessional', 'releasePrincipal', 'associatedEarnings',
    'assessableRelease', 'releaseTax', 'netRelease', 'overflowDeposit', 'bankDeposit', 'fhssDeposit'
  ]) {
    totals[key] = projections.reduce((sum, buyer) => sum + buyer[key], 0);
  }
  return { ...totals, boost: totals.fhssDeposit - totals.bankDeposit, buyers: projections };
}
