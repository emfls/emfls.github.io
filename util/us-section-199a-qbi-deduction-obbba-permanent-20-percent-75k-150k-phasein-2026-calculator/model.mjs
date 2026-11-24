const QBI_RATE = 0.20;
const ACTIVE_QBI_REQUIRED = 1000;
const ACTIVE_MINIMUM = 400;

const thresholds = new Map([
  ['single', 201750],
  ['hoh', 201750],
  ['mfj', 403500],
  ['mfs', 201775],
  ['qss', 201750],
]);

function calculateWindow(input, threshold, span, incomeCap) {
  const { taxableIncome, qbi, w2Wages, ubia, isSstb, materiallyParticipates } = input;
  const phaseInRatio = Math.max(0, Math.min(1, (taxableIncome - threshold) / span));

  // Section 199A(d)(3) reduces all three SSTB inputs before the wage limitation.
  const eligibleSpan = isSstb ? Math.max(0, Math.min(span, threshold + span - taxableIncome)) : span;
  const applicablePct = eligibleSpan / span;
  const eligibleQbi = qbi * applicablePct;
  const eligibleWages = w2Wages * applicablePct;
  const eligibleUbia = ubia * applicablePct;
  const wageUbiaCap = Math.max(0.50 * eligibleWages, 0.25 * eligibleWages + 0.025 * eligibleUbia);
  const tentativeDeduction = QBI_RATE * Math.max(0, eligibleQbi);
  const wageReduction = phaseInRatio * Math.max(0, tentativeDeduction - wageUbiaCap);
  const businessDeduction = tentativeDeduction - wageReduction;
  const regularDeduction = Math.min(businessDeduction, incomeCap);

  // Section 199A(i) compares the floor to the deduction after the income limitation.
  // Compare before division to keep exact $1,000 boundaries eligible.
  const minimumEligible = materiallyParticipates && qbi * eligibleSpan >= ACTIVE_QBI_REQUIRED * span;
  const deduction = minimumEligible ? Math.max(ACTIVE_MINIMUM, regularDeduction) : regularDeduction;

  return {
    phaseInRatio, applicablePct, eligibleQbi, eligibleWages, eligibleUbia,
    wageUbiaCap, tentativeDeduction, wageReduction, businessDeduction,
    regularDeduction, minimumEligible, deduction,
  };
}

export function calculateQbi(input) {
  const {
    filingStatus, taxableIncome, qbi, w2Wages, ubia, netCapitalGains,
    marginalRate, isSstb, materiallyParticipates,
  } = input;
  const threshold = thresholds.get(filingStatus);
  if (threshold === undefined) throw new RangeError('Select a supported filing status.');
  if (![taxableIncome, qbi, w2Wages, ubia, netCapitalGains, marginalRate].every(
    amount => Number.isFinite(amount) && Math.abs(amount) <= Number.MAX_SAFE_INTEGER,
  )) throw new RangeError('Enter a valid number in each numeric field.');
  if (w2Wages < 0 || ubia < 0 || netCapitalGains < 0 || marginalRate < 0 || marginalRate > 100) {
    throw new RangeError('Wages, property basis and gains must be nonnegative. Enter a tax rate from 0 to 100%.');
  }
  if (typeof isSstb !== 'boolean' || typeof materiallyParticipates !== 'boolean') {
    throw new RangeError('Select the business type and material participation status.');
  }

  const phaseInSpan = filingStatus === 'mfj' ? 150000 : 75000;
  const legacySpan = filingStatus === 'mfj' ? 100000 : 50000;
  const upperCap = threshold + phaseInSpan;
  const ordinaryIncome = Math.max(0, taxableIncome - netCapitalGains);
  const incomeCap = QBI_RATE * ordinaryIncome;
  const current = calculateWindow(input, threshold, phaseInSpan, incomeCap);
  const legacy = calculateWindow(input, threshold, legacySpan, incomeCap);

  let status = 'IN_EXPANDED_OBBBA_PHASEIN';
  if (taxableIncome <= threshold) status = 'BELOW_THRESHOLD_FULL_20';
  if (taxableIncome > upperCap) status = 'ABOVE_CAP';

  // Static benchmark for clearing the wage test, assuming reported QBI and UBIA stay fixed.
  let wageBenchmark = null;
  if (!isSstb && current.phaseInRatio > 0 && current.tentativeDeduction > 0
    && incomeCap > current.businessDeduction
    && (!current.minimumEligible || Math.min(current.tentativeDeduction, incomeCap) > ACTIVE_MINIMUM)) {
    const target = current.tentativeDeduction;
    wageBenchmark = Math.min(2 * target, 4 * Math.max(0, target - 0.025 * ubia));
  }

  return {
    ...current, threshold, phaseInSpan, upperCap, incomeCap, status, wageBenchmark,
    legacyWindowDeduction: legacy.deduction,
    extraDeduction: Math.max(0, current.deduction - legacy.deduction),
    estimatedTaxSaved: Math.min(current.deduction, ordinaryIncome) * (marginalRate / 100),
  };
}
