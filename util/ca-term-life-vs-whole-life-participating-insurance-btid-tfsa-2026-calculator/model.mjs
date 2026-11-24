// Canada Term Life vs Whole Life Participating Insurance Engine (BTID in TFSA 2026)

export function calculateTermVsWholeLife(params) {
  const {
    startingAge = 35,
    coverageAmount = 1000000,
    termMonthlyPremium = 65,
    termYears = 20,
    wholeLifeMonthlyPremium = 850,
    wholeLifePayYears = 20,
    investmentReturnPct = 6.5,
    dividendScalePct = 6.0,
    maxProjectionYears = 40
  } = params;

  if (coverageAmount <= 0 || termMonthlyPremium <= 0 || wholeLifeMonthlyPremium <= 0) {
    throw new RangeError("Coverage amount and premiums must be positive numbers.");
  }
  if (wholeLifeMonthlyPremium <= termMonthlyPremium) {
    throw new RangeError("Whole life premium must be greater than term life premium.");
  }

  const monthlySavings = wholeLifeMonthlyPremium - termMonthlyPremium;
  const annualSavings = monthlySavings * 12;
  const netInvReturn = investmentReturnPct / 100;

  let btidPortfolio = 0;
  let wholeLifeCumPremiums = 0;
  let termCumPremiums = 0;

  const trajectory = [];

  for (let year = 1; year <= maxProjectionYears; year++) {
    const age = startingAge + year;

    // Premium accumulation
    if (year <= termYears) {
      termCumPremiums += termMonthlyPremium * 12;
    }
    if (year <= wholeLifePayYears) {
      wholeLifeCumPremiums += wholeLifeMonthlyPremium * 12;
    }

    // BTID Portfolio growth
    if (year <= wholeLifePayYears) {
      btidPortfolio = (btidPortfolio + annualSavings) * (1 + netInvReturn);
    } else {
      // After whole life 20-pay ends, no further differential premiums, portfolio compounds
      btidPortfolio = btidPortfolio * (1 + netInvReturn);
    }

    // Term life coverage status
    const termActive = year <= termYears;
    const btidTotalEstate = (termActive ? coverageAmount : 0) + btidPortfolio;

    // Participating Whole Life CSV & Death Benefit Model (Standard Canadian Major Insurer Schedule)
    let wholeLifeCsv = 0;
    let wholeLifeDeathBenefit = coverageAmount;

    if (year <= 3) {
      // Early acquisition and underwriting cost drag
      wholeLifeCsv = wholeLifeCumPremiums * 0.25 * (year / 3);
      wholeLifeDeathBenefit = coverageAmount;
    } else if (year <= 10) {
      // Ramp-up to break-even around year 9-10
      const ratio = 0.35 + (0.70 * ((year - 3) / 7));
      wholeLifeCsv = wholeLifeCumPremiums * ratio;
      wholeLifeDeathBenefit = coverageAmount * Math.pow(1 + (dividendScalePct * 0.003), year);
    } else if (year <= wholeLifePayYears) {
      // Fully funded 20-pay CSV surpasses cumulative premiums (~165%)
      const ratio = 1.05 + (0.60 * ((year - 10) / 10));
      wholeLifeCsv = wholeLifeCumPremiums * ratio;
      wholeLifeDeathBenefit = coverageAmount * Math.pow(1 + (dividendScalePct * 0.0045), year);
    } else {
      // Post 20-pay: grows with full dividend scale
      const postYears = year - wholeLifePayYears;
      const csvAt20 = wholeLifeCumPremiums * 1.65;
      wholeLifeCsv = csvAt20 * Math.pow(1 + dividendScalePct / 100, postYears);
      wholeLifeDeathBenefit = (coverageAmount * Math.pow(1 + (dividendScalePct * 0.0045), 20)) * Math.pow(1 + (dividendScalePct * 0.007), postYears);
    }

    trajectory.push({
      year,
      age,
      btidPortfolio: Math.round(btidPortfolio),
      btidTotalEstate: Math.round(btidTotalEstate),
      wholeLifeCsv: Math.round(wholeLifeCsv),
      wholeLifeDeathBenefit: Math.round(wholeLifeDeathBenefit),
      termActive
    });
  }

  const getMetricsAtYear = (targetYear) => {
    return trajectory.find(t => t.year === targetYear) || trajectory[trajectory.length - 1];
  };

  const y10 = getMetricsAtYear(10);
  const y20 = getMetricsAtYear(20);
  const y30 = getMetricsAtYear(30);
  const y35 = getMetricsAtYear(35);

  return {
    monthlySavings,
    annualSavings,
    y10,
    y20,
    y30,
    y35,
    trajectory
  };
}
