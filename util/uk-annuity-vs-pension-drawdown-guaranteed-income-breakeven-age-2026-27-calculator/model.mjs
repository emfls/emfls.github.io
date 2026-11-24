// UK Annuity vs Pension Drawdown Guaranteed Income Engine (2026/27 Standards)

export function calculateAnnuityIncome(pot, annuityRatePct, escalationPct = 0) {
  if (pot <= 0 || annuityRatePct <= 0) {
    throw new RangeError("Pension pot and annuity rate must be positive.");
  }
  const year1Gross = pot * (annuityRatePct / 100);
  return {
    year1Gross,
    escalationPct
  };
}

export function simulateDrawdownAndBreakeven(params) {
  const {
    pot,
    startAge = 65,
    annuityRatePct = 7.1,
    escalationPct = 0,
    investmentReturnPct = 5.5,
    fundFeePct = 0.45,
    maxAge = 100
  } = params;

  if (pot <= 0 || annuityRatePct <= 0) {
    throw new RangeError("Pot and annuity rate must be positive numbers.");
  }
  if (startAge >= maxAge) {
    throw new RangeError("Start age must be less than maximum projection age.");
  }

  const netReturn = (investmentReturnPct - fundFeePct) / 100;
  const year1Annuity = pot * (annuityRatePct / 100);

  let currentDrawdownPot = pot;
  let cumAnnuity = 0;
  let cumDrawdown = 0;
  let currentAnnuityPayment = year1Annuity;

  let depletionAge = null;
  let breakevenAge = null;

  const trajectory = [];

  for (let age = startAge; age <= maxAge; age++) {
    // Annuity payment this year
    cumAnnuity += currentAnnuityPayment;

    // Check breakeven against initial pot
    if (breakevenAge === null && cumAnnuity >= pot) {
      breakevenAge = age;
    }

    // Drawdown withdrawal matching annuity
    let drawdownWithdrawal = 0;
    if (currentDrawdownPot > 0) {
      if (currentDrawdownPot >= currentAnnuityPayment) {
        drawdownWithdrawal = currentAnnuityPayment;
        currentDrawdownPot = (currentDrawdownPot - drawdownWithdrawal) * (1 + netReturn);
      } else {
        // Partial depletion year
        drawdownWithdrawal = currentDrawdownPot;
        currentDrawdownPot = 0;
        if (depletionAge === null) {
          depletionAge = age;
        }
      }
    } else {
      drawdownWithdrawal = 0;
      if (depletionAge === null) {
        depletionAge = age;
      }
    }

    cumDrawdown += drawdownWithdrawal;

    trajectory.push({
      age,
      annuityPayment: currentAnnuityPayment,
      cumulativeAnnuity: cumAnnuity,
      drawdownPotEnd: currentDrawdownPot,
      drawdownWithdrawal,
      cumulativeDrawdown: cumDrawdown
    });

    // Escalate annuity for next year if configured
    if (escalationPct > 0) {
      currentAnnuityPayment *= (1 + escalationPct / 100);
    }
  }

  // Estate valuations at benchmark ages
  const getEstateAt = (targetAge) => {
    const row = trajectory.find(r => r.age === targetAge);
    return row ? Math.round(row.drawdownPotEnd) : 0;
  };

  return {
    initialPot: pot,
    startAge,
    year1Annuity,
    depletionAge: depletionAge || ">100",
    breakevenAge: breakevenAge || ">100",
    estate75: getEstateAt(75),
    estate85: getEstateAt(85),
    estate95: getEstateAt(95),
    trajectory
  };
}

export function computeRetirementPlan(inputs) {
  const pot = parseFloat(inputs.pot) || 300000;
  const startAge = parseInt(inputs.startAge, 10) || 65;
  const annuityRatePct = parseFloat(inputs.annuityRatePct) || 7.1;
  const escalationPct = parseFloat(inputs.escalationPct) || 0;
  const investmentReturnPct = parseFloat(inputs.investmentReturnPct) || 5.5;
  const fundFeePct = parseFloat(inputs.fundFeePct) || 0.45;

  return simulateDrawdownAndBreakeven({
    pot,
    startAge,
    annuityRatePct,
    escalationPct,
    investmentReturnPct,
    fundFeePct
  });
}
