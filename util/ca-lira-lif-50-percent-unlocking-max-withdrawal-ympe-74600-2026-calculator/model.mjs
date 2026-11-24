// 2026 Canada YMPE & FSRA Ontario / Federal / CRA Statutory Parameters
export const CA_LIRA_CONSTANTS_2026 = {
  ympe2026: 74600, // 2026 Year's Maximum Pensionable Earnings
  smallBalancePercent: 0.40, // 40% of YMPE
  smallBalanceThreshold: 29840, // $29,840 for 2026
  maxUnlockingPercent: 0.50, // 50% one-time unlocking
  minimumUnlockingAge: 55,

  // Ontario Post-2008 LIF Statutory Minimum and Maximum Table by Age
  lifTable: {
    55: { min: 0.0286, max: 0.0651 },
    56: { min: 0.0294, max: 0.0657 },
    57: { min: 0.0303, max: 0.0663 },
    58: { min: 0.0313, max: 0.0670 },
    59: { min: 0.0323, max: 0.0677 },
    60: { min: 0.0333, max: 0.0685 },
    61: { min: 0.0345, max: 0.0694 },
    62: { min: 0.0357, max: 0.0704 },
    63: { min: 0.0370, max: 0.0714 },
    64: { min: 0.0385, max: 0.0725 },
    65: { min: 0.0400, max: 0.0738 },
    66: { min: 0.0417, max: 0.0752 },
    67: { min: 0.0435, max: 0.0767 },
    68: { min: 0.0455, max: 0.0784 },
    69: { min: 0.0476, max: 0.0802 },
    70: { min: 0.0500, max: 0.0822 },
    71: { min: 0.0528, max: 0.0845 },
    72: { min: 0.0540, max: 0.0871 },
    73: { min: 0.0553, max: 0.0900 },
    74: { min: 0.0567, max: 0.0934 },
    75: { min: 0.0582, max: 0.1021 },
    76: { min: 0.0598, max: 0.1069 },
    77: { min: 0.0617, max: 0.1125 },
    78: { min: 0.0636, max: 0.1190 },
    79: { min: 0.0658, max: 0.1268 },
    80: { min: 0.0685, max: 0.1362 },
    81: { min: 0.0708, max: 0.1475 },
    82: { min: 0.0738, max: 0.1614 },
    83: { min: 0.0771, max: 0.1788 },
    84: { min: 0.0808, max: 0.2009 },
    85: { min: 0.0851, max: 0.2145 },
    86: { min: 0.0899, max: 0.2312 },
    87: { min: 0.0955, max: 0.2520 },
    88: { min: 0.1021, max: 0.2786 },
    89: { min: 0.1099, max: 0.3143 },
    90: { min: 0.1121, max: 1.0000 }
  }
};

export function getLifRates(age) {
  const boundedAge = Math.max(55, Math.min(90, Math.floor(age)));
  return CA_LIRA_CONSTANTS_2026.lifTable[boundedAge] || { min: 0.0400, max: 0.0738 };
}

export function calcLiraUnlocking(inputs) {
  const {
    liraBalance = 300000,
    currentAge = 60,
    annualReturnPercent = 5.0, // %
    unlockFiftyPercent = true,
    targetAnnualCashNeeded = 30000
  } = inputs;

  const rates = getLifRates(currentAge);
  const isSmallBalanceEligible = liraBalance <= CA_LIRA_CONSTANTS_2026.smallBalanceThreshold;

  // Case 1: Standard LIF without 50% Unlocking (100% in LIF)
  const lifBalanceNoUnlock = liraBalance;
  const noUnlockMinWithdrawal = lifBalanceNoUnlock * rates.min;
  const noUnlockMaxWithdrawal = lifBalanceNoUnlock * rates.max;

  // Case 2: 50% Unlocking (Schedule 1.1 / Form 5.2)
  const unlockedAmount = unlockFiftyPercent ? (liraBalance * CA_LIRA_CONSTANTS_2026.maxUnlockingPercent) : 0;
  const remainingLifBalance = liraBalance - unlockedAmount;
  const unlockedLifMinWithdrawal = remainingLifBalance * rates.min;
  const unlockedLifMaxWithdrawal = remainingLifBalance * rates.max;

  // With unlocked 50% in flexible RRSP/RRIF:
  // The unlocked portion has NO statutory maximum limit!
  // Total maximum potential withdrawal in year 1 = unlockedLifMaxWithdrawal + unlockedAmount (from RRSP/RRIF)
  const totalMaxPotentialCashYear1 = unlockedLifMaxWithdrawal + unlockedAmount;

  // Cashflow shortfall check against target cash
  const shortfallNoUnlock = Math.max(0, targetAnnualCashNeeded - noUnlockMaxWithdrawal);
  const shortfallWithUnlock = Math.max(0, targetAnnualCashNeeded - totalMaxPotentialCashYear1);

  // 15-Year projection simulation
  const projection = [];
  let balNoUnlock = lifBalanceNoUnlock;
  let balLockedWithUnlock = remainingLifBalance;
  let balFlexibleWithUnlock = unlockedAmount;

  for (let y = 1; y <= 15; y++) {
    const ageAtYear = currentAge + y - 1;
    const yRates = getLifRates(ageAtYear);

    // Scenario A: Withdraw MAX possible from LIF
    const maxA = balNoUnlock * yRates.max;
    balNoUnlock = Math.max(0, (balNoUnlock - maxA) * (1 + annualReturnPercent / 100));

    // Scenario B: Withdraw target from LIF (up to max), balance from flexible RRSP
    const maxBLif = balLockedWithUnlock * yRates.max;
    const withdrawFromLif = Math.min(targetAnnualCashNeeded, maxBLif);
    balLockedWithUnlock = Math.max(0, (balLockedWithUnlock - withdrawFromLif) * (1 + annualReturnPercent / 100));

    const remainingCashNeed = Math.max(0, targetAnnualCashNeeded - withdrawFromLif);
    const withdrawFromFlex = Math.min(balFlexibleWithUnlock, remainingCashNeed);
    balFlexibleWithUnlock = Math.max(0, (balFlexibleWithUnlock - withdrawFromFlex) * (1 + annualReturnPercent / 100));

    projection.push({
      year: y,
      age: ageAtYear,
      maxWithoutUnlock: Math.round(maxA),
      balWithoutUnlock: Math.round(balNoUnlock),
      lockedLifBal: Math.round(balLockedWithUnlock),
      flexRrspBal: Math.round(balFlexibleWithUnlock),
      totalBalWithUnlock: Math.round(balLockedWithUnlock + balFlexibleWithUnlock)
    });
  }

  return {
    liraBalance: Math.round(liraBalance),
    currentAge,
    ympe2026: CA_LIRA_CONSTANTS_2026.ympe2026,
    smallBalanceThreshold: CA_LIRA_CONSTANTS_2026.smallBalanceThreshold,
    isSmallBalanceEligible,

    minWithdrawalRatePercent: Math.round(rates.min * 10000) / 100,
    maxWithdrawalRatePercent: Math.round(rates.max * 10000) / 100,

    // Without Unlocking
    noUnlockMinWithdrawal: Math.round(noUnlockMinWithdrawal),
    noUnlockMaxWithdrawal: Math.round(noUnlockMaxWithdrawal),
    shortfallNoUnlock: Math.round(shortfallNoUnlock),

    // With 50% Unlocking
    unlockedAmount: Math.round(unlockedAmount),
    remainingLifBalance: Math.round(remainingLifBalance),
    unlockedLifMinWithdrawal: Math.round(unlockedLifMinWithdrawal),
    unlockedLifMaxWithdrawal: Math.round(unlockedLifMaxWithdrawal),
    totalMaxPotentialCashYear1: Math.round(totalMaxPotentialCashYear1),
    shortfallWithUnlock: Math.round(shortfallWithUnlock),

    extraCashFlexibility: Math.round(totalMaxPotentialCashYear1 - noUnlockMaxWithdrawal),
    projection
  };
}
