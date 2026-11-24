/**
 * Tool 499: 2026–27 Australia ATO Director Penalty Notice & SBR Calculator
 * Pure deterministic ESM module.
 */

export const SBR_LIABILITY_CAP = 1000000; // Corporations Act Part 5.3B cap is $1M AUD

export function calcDpnExposure(params) {
  const unpaidPayg = Math.max(0, Number(params.unpaidPayg ?? 60000));
  const unpaidGst = Math.max(0, Number(params.unpaidGst ?? 45000));
  const unpaidSgc = Math.max(0, Number(params.unpaidSgc ?? 25000));

  const isBasLateMoreThan3Months = Boolean(params.isBasLateMoreThan3Months ?? false);
  const isSgcLatePastDueDate = Boolean(params.isSgcLatePastDueDate ?? true);

  const totalCompanyLiabilities = Math.max(0, Number(params.totalCompanyLiabilities ?? 450000));
  const sbrDividendCents = Math.min(100, Math.max(0, Number(params.sbrDividendCents ?? 25))); // 25c on dollar
  const directorPersonalAssets = Math.max(0, Number(params.directorPersonalAssets ?? 800000));

  const totalAtoDebt = unpaidPayg + unpaidGst + unpaidSgc;

  // Lockdown calculation:
  // PAYG & GST lock down if BAS unlodged > 3 months from due date
  const paygGstLockdown = isBasLateMoreThan3Months ? (unpaidPayg + unpaidGst) : 0;
  // SGC locks down immediately if not lodged by statutory due date (28 days post quarter)
  const sgcLockdown = isSgcLatePastDueDate ? unpaidSgc : 0;

  const totalLockdownDpn = paygGstLockdown + sgcLockdown;
  const totalNonLockdownDpn = totalAtoDebt - totalLockdownDpn;

  // SBR Eligibility (< $1,000,000 total company debt)
  const isSbrEligible = totalCompanyLiabilities < SBR_LIABILITY_CAP;

  let sbrSettlementCost = totalNonLockdownDpn;
  let sbrDebtForgiven = 0;

  if (isSbrEligible && totalNonLockdownDpn > 0) {
    sbrSettlementCost = Math.round(totalNonLockdownDpn * (sbrDividendCents / 100));
    sbrDebtForgiven = totalNonLockdownDpn - sbrSettlementCost;
  }

  // Final personal cash exposure for director:
  // 100% of Lockdown DPN (cannot be discharged) + SBR settlement (or full non-lockdown if ineligible)
  const totalDirectorPersonalExposure = totalLockdownDpn + (isSbrEligible ? sbrSettlementCost : totalNonLockdownDpn);
  const personalAssetCoveragePercent = directorPersonalAssets > 0 ? (totalDirectorPersonalExposure / directorPersonalAssets) * 100 : 0;

  return {
    totalAtoDebt,
    unpaidPayg,
    unpaidGst,
    unpaidSgc,
    totalLockdownDpn,
    totalNonLockdownDpn,
    isSbrEligible,
    sbrDividendCents,
    sbrSettlementCost,
    sbrDebtForgiven,
    totalDirectorPersonalExposure,
    directorPersonalAssets,
    personalAssetCoveragePercent: Math.round(personalAssetCoveragePercent * 10) / 10,
    hasLockdownTrap: totalLockdownDpn > 0
  };
}
