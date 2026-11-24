/**
 * Tool 512: Canada Construction Holdback (10%) & Cash-Flow Release Calculator (2026 Ontario Annual Reform vs BC 55-Day)
 * Ontario Construction Act (R.S.O. 1990, c. C.30, s. 22 & 2026 Annual Release Amendments) & BC Builders Lien Act (S.B.C. 1997, c. 45)
 */

export function calculateConstructionHoldback(params) {
  const {
    province = 'ON', // 'ON' (Ontario) or 'BC' (British Columbia)
    totalContractValue = 2500000,
    projectDurationYears = 3,
    lineOfCreditInterestRate = 7.5, // % per annum carrying cost for contractor borrowing against locked holdback
    startDate = '2026-01-15'
  } = params;

  const contractVal = Math.max(0, parseFloat(totalContractValue) || 0);
  const years = Math.max(1, parseInt(projectDurationYears, 10) || 1);
  const locRate = Math.max(0, parseFloat(lineOfCreditInterestRate) || 0) / 100;
  const holdbackRate = 0.10; // Mandatory 10% statutory holdback
  const totalHoldback = contractVal * holdbackRate;

  // Annual Progress / Holdback Breakdown
  const annualContractProgress = contractVal / years;
  const annualHoldbackAccrued = annualContractProgress * holdbackRate;

  // Ontario Jan 1, 2026 Mandatory Annual Release Reform
  // Under the 2026 amendments, for multi-year contracts:
  // - Holdback is released annually within 60 to 74 days of contract anniversary (following Form 6 publication within 14 days)
  // - Saves contractor carrying interest across multi-year timeline
  const ontarioSchedule = [];
  let ontarioCumulativeInterestSaved = 0;
  const startDt = new Date(startDate);

  for (let yr = 1; yr <= years; yr++) {
    const anniversaryDate = new Date(startDt);
    anniversaryDate.setFullYear(startDt.getFullYear() + yr);

    const form6Deadline = new Date(anniversaryDate);
    form6Deadline.setDate(anniversaryDate.getDate() + 14);

    const mandatoryReleaseDate = new Date(anniversaryDate);
    mandatoryReleaseDate.setDate(anniversaryDate.getDate() + 60);

    const subFlowDownDeadline = new Date(mandatoryReleaseDate);
    subFlowDownDeadline.setDate(mandatoryReleaseDate.getDate() + 14);

    // Interest carrying cost saved by releasing year yr holdback at yr instead of waiting until project end (year N)
    const yearsAccelerated = years - yr;
    const interestSaved = annualHoldbackAccrued * locRate * yearsAccelerated;
    ontarioCumulativeInterestSaved += interestSaved;

    ontarioSchedule.push({
      year: yr,
      annualBilling: Math.round(annualContractProgress),
      holdbackRetained: Math.round(annualHoldbackAccrued),
      anniversaryDate: anniversaryDate.toISOString().split('T')[0],
      form6NoticeDeadline: form6Deadline.toISOString().split('T')[0],
      mandatoryReleaseDate: mandatoryReleaseDate.toISOString().split('T')[0],
      subcontractorFlowDownDate: subFlowDownDeadline.toISOString().split('T')[0],
      yearsAccelerated,
      interestSaved: Math.round(interestSaved)
    });
  }

  // Traditional End-of-Project Release Carrying Cost
  // In traditional regime (before 2026 annual reform), all holdbacks are held until final completion:
  let traditionalTotalInterestCost = 0;
  for (let yr = 1; yr <= years; yr++) {
    const yearsHeld = years - yr + 0.5; // Average holding period until final release
    traditionalTotalInterestCost += annualHoldbackAccrued * locRate * yearsHeld;
  }

  // British Columbia 55-Day Holdback Release Timeline (BC Builders Lien Act)
  // - Substantial completion / Certificate of Completion issued
  // - 45 days: Builders lien filing window
  // - 55 days: Holdback release safe harbor date
  const bcCompletionDate = new Date(startDt);
  bcCompletionDate.setFullYear(startDt.getFullYear() + years);

  const bcLienDeadline = new Date(bcCompletionDate);
  bcLienDeadline.setDate(bcCompletionDate.getDate() + 45);

  const bcHoldbackReleaseDate = new Date(bcCompletionDate);
  bcHoldbackReleaseDate.setDate(bcCompletionDate.getDate() + 55);

  const bcMandatoryJointAccount = contractVal > 100000;

  return {
    province,
    totalContractValue: Math.round(contractVal),
    projectDurationYears: years,
    lineOfCreditInterestRate: Math.round(locRate * 10000) / 100,
    statutoryHoldbackRate: 10,
    totalHoldback: Math.round(totalHoldback),
    annualHoldbackAccrued: Math.round(annualHoldbackAccrued),
    traditionalTotalInterestCost: Math.round(traditionalTotalInterestCost),
    ontarioAnnualReform: {
      totalInterestSaved: Math.round(ontarioCumulativeInterestSaved),
      netCarryingCostWithAnnualRelease: Math.round(Math.max(0, traditionalTotalInterestCost - ontarioCumulativeInterestSaved)),
      schedule: ontarioSchedule
    },
    bcBuildersLien: {
      substantialCompletionDate: bcCompletionDate.toISOString().split('T')[0],
      lienFiling45DayDeadline: bcLienDeadline.toISOString().split('T')[0],
      holdbackRelease55DayDate: bcHoldbackReleaseDate.toISOString().split('T')[0],
      mandatoryJointAccountRequired: bcMandatoryJointAccount,
      statutoryReference: 'BC Builders Lien Act s. 4 & s. 5 (Joint Trust Account required for private projects >$100,000)'
    }
  };
}
