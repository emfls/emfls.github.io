export const DIVIDEND_RATES = Object.freeze({ basic: 0.1075, higher: 0.3575, additional: 0.3935 });

const VCT_CAP = 200_000;
const SEIS_CAP = 200_000;
const EIS_STANDARD_CAP = 1_000_000;
const VCT_RATE = 0.20;
const PRIOR_VCT_RATE = 0.30;
const VCT_RATE_CHANGE = '2026-04-06';

function nonNegative(name, value) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a finite, non-negative number.`);
}

function scheme(investment, eligibleInvestment, rate, incomeTax, lossRate) {
  const relief = Math.min(eligibleInvestment * rate, incomeTax);
  const lossTaxSaving = (eligibleInvestment - relief) * lossRate;
  return { eligibleInvestment, relief, lossTaxSaving, netAtRisk: investment - relief - lossTaxSaving };
}

export function compareRelief({ investment, incomeTax, linkedSales, kicInvestment, annualDividends, lossRate, gain }) {
  for (const [name, value] of Object.entries({ investment, incomeTax, linkedSales, kicInvestment, annualDividends, lossRate, gain })) {
    nonNegative(name, value);
  }
  if (lossRate > 1) throw new RangeError('Loss-year marginal Income Tax rate must not exceed 100%.');

  const vctEligible = Math.min(VCT_CAP, Math.max(0, investment - linkedSales));
  const capFirstEligible = Math.max(0, Math.min(VCT_CAP, investment) - linkedSales);
  const eisEligible = Math.min(investment, EIS_STANDARD_CAP + Math.min(EIS_STANDARD_CAP, kicInvestment));
  const seisEligible = Math.min(SEIS_CAP, investment);
  const vct = scheme(investment, vctEligible, VCT_RATE, incomeTax, 0);
  const eis = scheme(investment, eisEligible, 0.30, incomeTax, lossRate);
  const seis = scheme(investment, seisEligible, 0.50, incomeTax, lossRate);
  const priorVctRelief = Math.min(vctEligible * PRIOR_VCT_RATE, incomeTax);
  const dividendSavings = Object.fromEntries(
    Object.entries(DIVIDEND_RATES).map(([band, rate]) => [band, annualDividends * 5 * rate])
  );

  return {
    vct, eis, seis, priorVctRelief, dividendSavings,
    lostVctRelief: priorVctRelief - vct.relief,
    capFirstVctRelief: Math.min(capFirstEligible * VCT_RATE, incomeTax),
    eisDeferredGain: Math.min(gain, investment),
    seisExemptGain: Math.min(gain * 0.5, seis.relief)
  };
}

export function vctClawback({ issueDate, yearsHeld, proceeds, reliefReceived, armLength }) {
  nonNegative('Years held', yearsHeld);
  nonNegative('Proceeds', proceeds);
  nonNegative('Relief received on shares sold', reliefReceived);
  if (typeof armLength !== 'boolean') throw new TypeError('Specify whether the sale is at arm’s length.');

  const date = new Date(issueDate);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== issueDate ||
      issueDate < '2006-04-06' || issueDate >= '2027-04-06') {
    throw new RangeError('Issue date must be a valid date from 6 April 2006 to 5 April 2027.');
  }

  const issueRate = issueDate < VCT_RATE_CHANGE ? PRIOR_VCT_RATE : VCT_RATE;
  const withdrawal = rate => {
    if (yearsHeld >= 5) return 0;
    return armLength ? Math.min(reliefReceived, proceeds * rate) : reliefReceived;
  };
  return {
    issueRate,
    issueRateClawback: withdrawal(issueRate),
    section266Clawback: withdrawal(PRIOR_VCT_RATE)
  };
}
