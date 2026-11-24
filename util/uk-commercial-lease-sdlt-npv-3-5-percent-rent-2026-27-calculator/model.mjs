/**
 * Tool 510: UK Commercial Lease SDLT Net Present Value (NPV 3.5%) & Premium Calculator (2026/27 HMRC)
 * Finance Act 2003 Schedule 5
 */

export function calculateCommercialLeaseSDLT(params) {
  const {
    leaseTermYears = 5,
    annualRent = 50000,
    hasVat = false, // If true, rent + 20% standard VAT
    rentFreeMonths = 0, // Rent-free incentive period
    upfrontPremium = 0, // Upfront capital sum / premium
    steppedRents = null // Optional array of per-year rents
  } = params;

  const years = Math.max(1, parseInt(leaseTermYears, 10) || 1);
  const vatRate = hasVat ? 0.20 : 0.0;
  const baseAnnualRent = Math.max(0, parseFloat(annualRent) || 0);
  const grossAnnualRent = baseAnnualRent * (1 + vatRate);
  const premium = Math.max(0, parseFloat(upfrontPremium) || 0);
  const rentFree = Math.max(0, parseFloat(rentFreeMonths) || 0);

  // Build Year-by-Year Rent Schedule
  const rentSchedule = [];
  let npv = 0;
  const discountRate = 0.035;

  for (let t = 1; t <= years; t++) {
    let yearRent = 0;
    if (Array.isArray(steppedRents) && steppedRents.length >= t) {
      yearRent = (parseFloat(steppedRents[t - 1]) || 0) * (1 + vatRate);
    } else {
      yearRent = grossAnnualRent;
      // Handle rent free months in year 1 or beyond
      if (rentFree > 0) {
        if (t === 1) {
          const paidMonths = Math.max(0, 12 - rentFree);
          yearRent = (grossAnnualRent / 12) * paidMonths;
        } else if (rentFree > 12 && t === 2) {
          const remMonths = rentFree - 12;
          const paidMonths = Math.max(0, 12 - remMonths);
          yearRent = (grossAnnualRent / 12) * paidMonths;
        }
      }
    }

    // Schedule 5 discount formula: Rent_t / (1.035)^t
    const discountFactor = Math.pow(1 + discountRate, t);
    const discountedValue = yearRent / discountFactor;
    npv += discountedValue;

    rentSchedule.push({
      year: t,
      grossRent: yearRent,
      discountFactor: Math.round(discountFactor * 10000) / 10000,
      discountedValue: Math.round(discountedValue * 100) / 100
    });
  }

  npv = Math.round(npv);

  // 1. SDLT on Lease Rent (Calculated on NPV)
  // Non-residential rates:
  // £0 – £150,000: 0%
  // £150,001 – £5,000,000: 1%
  // Over £5,000,000: 2%
  let rentSdlt = 0;
  let band1Portion = 0;
  let band2Portion = 0;
  let band3Portion = 0;

  if (npv <= 150000) {
    rentSdlt = 0;
    band1Portion = npv;
  } else if (npv <= 5000000) {
    band1Portion = 150000;
    band2Portion = npv - 150000;
    rentSdlt = band2Portion * 0.01;
  } else {
    band1Portion = 150000;
    band2Portion = 4850000; // £5,000,000 - £150,000
    band3Portion = npv - 5000000;
    rentSdlt = (band2Portion * 0.01) + (band3Portion * 0.02);
  }

  rentSdlt = Math.round(rentSdlt);

  // 2. SDLT on Lease Premium (Non-Residential Freehold/Premium Slices)
  // Up to £150,000: 0%
  // £150,001 – £250,000 (next £100k): 2%
  // Over £250,000: 5%
  let premiumSdlt = 0;
  let premBand1 = 0;
  let premBand2 = 0;
  let premBand3 = 0;

  if (premium <= 150000) {
    premBand1 = premium;
    premiumSdlt = 0;
  } else if (premium <= 250000) {
    premBand1 = 150000;
    premBand2 = premium - 150000;
    premiumSdlt = premBand2 * 0.02;
  } else {
    premBand1 = 150000;
    premBand2 = 100000;
    premBand3 = premium - 250000;
    premiumSdlt = (100000 * 0.02) + (premBand3 * 0.05);
  }

  premiumSdlt = Math.round(premiumSdlt);
  const totalSdlt = rentSdlt + premiumSdlt;
  const totalContractRent = rentSchedule.reduce((acc, row) => acc + row.grossRent, 0);

  return {
    leaseTermYears: years,
    baseAnnualRent,
    hasVat,
    grossAnnualRent,
    upfrontPremium: premium,
    rentFreeMonths: rentFree,
    npv,
    totalContractRent: Math.round(totalContractRent),
    rentSdlt,
    premiumSdlt,
    totalSdlt,
    effectiveRateOnNpv: npv > 0 ? ((rentSdlt / npv) * 100).toFixed(2) : '0.00',
    breakdown: {
      rentBands: {
        zeroBand: band1Portion,
        onePercentBand: band2Portion,
        twoPercentBand: band3Portion
      },
      premiumBands: {
        zeroBand: premBand1,
        twoPercentBand: premBand2,
        fivePercentBand: premBand3
      }
    },
    rentSchedule
  };
}
