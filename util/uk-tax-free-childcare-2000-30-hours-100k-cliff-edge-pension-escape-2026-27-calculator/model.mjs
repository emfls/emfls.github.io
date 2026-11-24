export const RULES = Object.freeze({
  incomeLimit: 100_000,
  target: 99_999,
  personalAllowance: 12_570,
  basicBand: 37_700,
  additionalThreshold: 125_140,
  niUpperLimit: 50_270,
  fundedHours: 1140,
  universalHours: 570,
  quarterlyTopUp: 500,
  disabledQuarterlyTopUp: 1000
});

const money = value => Math.round(value * 100) / 100;
const excess = (value, threshold) => Math.max(0, value - threshold);

export function employmentTax(pay, grossRelief = 0) {
  const ani = money(pay - grossRelief);
  const allowance = excess(RULES.personalAllowance, excess(ani, RULES.incomeLimit) / 2);
  const taxable = excess(pay, allowance);
  const basicBand = RULES.basicBand + grossRelief;
  const additionalThreshold = RULES.additionalThreshold + grossRelief;
  const incomeTax = Math.min(taxable, basicBand) * 0.20
    + Math.min(excess(taxable, basicBand), additionalThreshold - basicBand) * 0.40
    + excess(taxable, additionalThreshold) * 0.45;
  const ni = Math.min(excess(pay, RULES.personalAllowance), RULES.niUpperLimit - RULES.personalAllowance) * 0.08
    + excess(pay, RULES.niUpperLimit) * 0.02;
  return { ani, allowance, incomeTax, ni, netPay: pay - incomeTax - ni };
}

export function childcareCosts(children, hourlyRate, passesIncomeTest, taxFree, funded) {
  return children.reduce((totals, child) => {
    const universal = child.stage === 'universal' ? RULES.universalHours : 0;
    const working = passesIncomeTest && funded && child.stage !== 'none';
    const hours = Math.min(child.hours, working ? RULES.fundedHours : universal);
    const fees = child.quarterlyFees.reduce((total, fee) => total + fee, 0);
    const cap = child.disabled ? RULES.disabledQuarterlyTopUp : RULES.quarterlyTopUp;
    const fundedValue = Math.min(fees, money(hours * hourlyRate));

    // Spread the bill reduction in proportion to charges in each entitlement period.
    const billFraction = fees > 0 ? (fees - fundedValue) / fees : 0;
    const topUp = passesIncomeTest && taxFree && child.taxFree
      ? money(child.quarterlyFees.reduce((sum, fee) => sum + Math.min(cap, fee * billFraction * 0.2), 0))
      : 0;

    return {
      hours: totals.hours + hours,
      fundedValue: money(totals.fundedValue + fundedValue),
      topUp: money(totals.topUp + topUp),
      familyCost: money(totals.familyCost + fees - fundedValue - topUp)
    };
  }, { hours: 0, fundedValue: 0, topUp: 0, familyCost: 0 });
}

function compareScenario(plan, method, childcare) {
  const adults = plan.map(({ pay, reduction }) => {
    const reductionPence = Math.round(reduction * 100);
    // Round the cash payment up so grossed-up relief reaches the target to the penny.
    const paymentPence = Math.ceil(reductionPence * 4 / 5);
    const personalPayment = method === 'sipp' || method === 'giftAid' ? paymentPence / 100 : 0;
    const grossRelief = personalPayment > 0 ? Math.floor(paymentPence * 5 / 4) / 100 : 0;
    const sacrifice = method === 'sacrifice' ? reduction : 0;
    return {
      ...employmentTax(money(pay - sacrifice), grossRelief),
      personalPayment,
      grossReduction: sacrifice + grossRelief,
      pension: method === 'sipp' ? grossRelief : sacrifice
    };
  });
  const passesIncomeTest = adults.every(adult => adult.ani <= RULES.incomeLimit);
  const care = childcare(passesIncomeTest);
  const cash = money(adults.reduce((sum, adult) => sum + adult.netPay - adult.personalPayment, 0) - care.familyCost);
  const pension = money(adults.reduce((sum, adult) => sum + adult.pension, 0));
  return { adults, passesIncomeTest, care, cash, pension, cashPlusPension: money(cash + pension) };
}

export function calculate({ salaries, children, hourlyRate, taxFree = true, funded = true }) {
  const care = childcareCosts(children, hourlyRate, true, taxFree, funded);
  const withoutSupport = childcareCosts(children, hourlyRate, false, taxFree, funded);
  const childcare = eligible => eligible ? care : withoutSupport;
  const plan = salaries.map(pay => ({
    pay,
    reduction: pay > RULES.incomeLimit ? money(pay - RULES.target) : 0
  }));
  const cash = compareScenario(plan, 'cash', childcare);
  const sacrifice = compareScenario(plan, 'sacrifice', childcare);
  const sipp = compareScenario(plan, 'sipp', childcare);
  const giftAid = compareScenario(plan, 'giftAid', childcare);

  const higherIndex = salaries[1] > salaries[0] ? 1 : 0;
  const otherPay = salaries[1 - higherIndex] ?? 0;
  let cliff = null;
  if (otherPay <= RULES.incomeLimit) {
    const atSalary = pay => compareScenario([{ pay, reduction: 0 }, { pay: otherPay, reduction: 0 }], 'cash', childcare).cash;
    const before = atSalary(RULES.target);
    const after = atSalary(RULES.incomeLimit + 1);
    const loss = money(before - after);
    let breakEven = null;
    if (loss > 0) {
      let low = RULES.incomeLimit * 100 + 1;
      let high = (RULES.additionalThreshold + Math.ceil(care.fundedValue / 0.53 + care.topUp / 0.53) + 1) * 100;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (atSalary(mid / 100) >= before) high = mid;
        else low = mid + 1;
      }
      breakEven = low / 100;
    }
    cliff = { before, after, loss, breakEven };
  }

  return {
    cash, sacrifice, sipp, giftAid, cliff,
    supportAtRisk: money(withoutSupport.familyCost - care.familyCost)
  };
}
