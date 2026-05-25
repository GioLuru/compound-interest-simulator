const STORAGE_KEY = "compoundInterest.taxScenario";

/**
 * TaxSettings
 * {
 *   country: "IT" | "CUSTOM";
 *   ordinaryCapitalGainTaxRate: number;
 *   governmentBondTaxRate: number;
 *   dividendTaxRate: number;
 *   corporateBondCouponTaxRate: number;
 *   depositInterestTaxRate: number;
 *   fundEtfTaxRate: number;
 *   stampDutyRate: number;
 *   ivafeRate: number;
 *   applyStampDuty: boolean;
 *   applyIvafe: boolean;
 *   stampDutyMin?: number;
 *   stampDutyMax?: number;
 *   brokerTaxRegime: "ADMINISTERED" | "DECLARATIVE" | "MANAGED" | "CUSTOM";
 *   ordinaryTaxQuota: number;
 *   governmentBondTaxQuota: number;
 *   lossCarryForward: number;
 *   allowLossOffset: boolean;
 *   offsettableGainPercentage: number;
 *   remainingLossCarryForwardYears?: number;
 *   taxCapitalGainAtExit: boolean;
 *   taxDistributionsAnnually: boolean;
 *   taxUnrealizedGainsAnnually: boolean;
 * }
 */
const italianDefaultTaxSettings = {
  country: "IT",
  ordinaryCapitalGainTaxRate: 0.26,
  governmentBondTaxRate: 0.125,
  dividendTaxRate: 0.26,
  corporateBondCouponTaxRate: 0.26,
  depositInterestTaxRate: 0.26,
  fundEtfTaxRate: 0.26,
  stampDutyRate: 0.002,
  ivafeRate: 0.002,
  applyStampDuty: true,
  applyIvafe: false,
  stampDutyMin: undefined,
  stampDutyMax: undefined,
  brokerTaxRegime: "ADMINISTERED",
  ordinaryTaxQuota: 1,
  governmentBondTaxQuota: 0,
  lossCarryForward: 0,
  allowLossOffset: true,
  offsettableGainPercentage: 1,
  remainingLossCarryForwardYears: undefined,
  taxCapitalGainAtExit: true,
  taxDistributionsAnnually: true,
  taxUnrealizedGainsAnnually: false
};

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

const percentFormatter = new Intl.NumberFormat("it-IT", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

let taxSettings = cloneTaxSettings(italianDefaultTaxSettings);
let manualTaxEditing = false;
let currentMode = "simple";
let scenarios = [];

const form = document.querySelector("#simulator-form");
const modeButtons = document.querySelectorAll(".mode-button");
const taxCountry = document.querySelector("#tax-country");
const manualTaxToggle = document.querySelector("#manualTaxToggle");
const taxInputs = document.querySelectorAll("[data-tax-field]");
const validationList = document.querySelector("#validationList");
const scenarioList = document.querySelector("#scenarioList");
const managedRegimeNote = document.querySelector("#managedRegimeNote");

function cloneTaxSettings(settings) {
  return JSON.parse(JSON.stringify(settings));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getInputNumber(id, fallback = 0) {
  return toNumber(document.querySelector(`#${id}`).value, fallback);
}

function readInvestmentSettings() {
  return {
    initialCapital: Math.max(0, getInputNumber("initialCapital")),
    monthlyContribution: Math.max(0, getInputNumber("monthlyContribution")),
    annualReturnRate: Math.max(-0.999, getInputNumber("annualReturnRate") / 100),
    years: Math.max(1, Math.floor(getInputNumber("years", 1))),
    annualRateConvention: document.querySelector("#annualRateConvention").value,
    contributionTiming: document.querySelector("#contributionTiming").value,
    instrumentType: document.querySelector("#instrumentType").value,
    annualDistributionYield: Math.max(0, getInputNumber("annualDistributionYield")) / 100,
    annualTer: Math.max(0, getInputNumber("annualTer")) / 100,
    foreignBroker: document.querySelector("#foreignBroker").checked
  };
}

function setMode(mode) {
  currentMode = mode;
  document.body.classList.toggle("simple-mode", mode === "simple");
  modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  update();
}

function getTaxFieldValue(input) {
  const kind = input.dataset.kind;

  if (kind === "boolean") {
    return input.checked;
  }

  if (kind === "percent") {
    return toNumber(input.value) / 100;
  }

  if (kind === "optionalNumber") {
    return input.value === "" ? undefined : toNumber(input.value);
  }

  return input.tagName === "SELECT" ? input.value : toNumber(input.value);
}

function setTaxFieldValue(input, value) {
  const kind = input.dataset.kind;

  if (kind === "boolean") {
    input.checked = Boolean(value);
    return;
  }

  if (kind === "percent") {
    input.value = value === undefined ? "" : formatInputNumber(value * 100);
    return;
  }

  if (kind === "optionalNumber") {
    input.value = value === undefined ? "" : String(value);
    return;
  }

  input.value = value;
}

function formatInputNumber(value) {
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}

function renderTaxFields() {
  taxCountry.value = taxSettings.country;

  taxInputs.forEach((input) => {
    const field = input.dataset.taxField;
    setTaxFieldValue(input, taxSettings[field]);
  });

  const fieldsAreEditable = manualTaxEditing || taxSettings.country === "CUSTOM";
  taxInputs.forEach((input) => {
    const field = input.dataset.taxField;
    const isRegime = field === "brokerTaxRegime";
    const isManualPatrimonial =
      taxSettings.brokerTaxRegime === "CUSTOM" &&
      (field === "applyStampDuty" || field === "applyIvafe");
    input.disabled = !(fieldsAreEditable || isRegime || isManualPatrimonial);
  });

  manualTaxToggle.textContent = fieldsAreEditable
    ? "Blocca parametri e torna al preset Italia"
    : "Modifica manualmente i parametri fiscali";

  managedRegimeNote.classList.toggle("is-hidden", taxSettings.brokerTaxRegime !== "MANAGED");
}

function handleTaxInputChange(event) {
  const input = event.target.closest("[data-tax-field]");
  if (!input) {
    return;
  }

  const field = input.dataset.taxField;
  taxSettings[field] = getTaxFieldValue(input);

  if (field === "ordinaryTaxQuota") {
    taxSettings.ordinaryTaxQuota = clamp(taxSettings.ordinaryTaxQuota, 0, 1);
    taxSettings.governmentBondTaxQuota = 1 - taxSettings.ordinaryTaxQuota;
  }

  if (field === "governmentBondTaxQuota") {
    taxSettings.governmentBondTaxQuota = clamp(taxSettings.governmentBondTaxQuota, 0, 1);
    taxSettings.ordinaryTaxQuota = 1 - taxSettings.governmentBondTaxQuota;
  }

  if (field === "brokerTaxRegime") {
    applyRegimeDefaults(readInvestmentSettings());
  }

  if (field === "applyStampDuty" && taxSettings.applyStampDuty && taxSettings.brokerTaxRegime !== "CUSTOM") {
    taxSettings.applyIvafe = false;
  }

  if (field === "applyIvafe" && taxSettings.applyIvafe && taxSettings.brokerTaxRegime !== "CUSTOM") {
    taxSettings.applyStampDuty = false;
  }

  renderTaxFields();
  update();
}

function applyRegimeDefaults(settings) {
  if (taxSettings.brokerTaxRegime === "ADMINISTERED") {
    taxSettings.applyStampDuty = true;
    taxSettings.applyIvafe = false;
  }

  if (taxSettings.brokerTaxRegime === "DECLARATIVE") {
    taxSettings.applyStampDuty = false;
    taxSettings.applyIvafe = Boolean(settings.foreignBroker);
  }
}

function getEffectiveCapitalGainTaxRate(settings) {
  return (
    settings.ordinaryTaxQuota * settings.ordinaryCapitalGainTaxRate +
    settings.governmentBondTaxQuota * settings.governmentBondTaxRate
  );
}

function getDistributionTaxRate(settings, instrumentType) {
  if (instrumentType === "STOCK") {
    return settings.dividendTaxRate;
  }

  if (instrumentType === "CORPORATE_BOND") {
    return settings.corporateBondCouponTaxRate;
  }

  if (instrumentType === "GOVERNMENT_BOND") {
    return settings.governmentBondTaxRate;
  }

  if (instrumentType === "DEPOSIT") {
    return settings.depositInterestTaxRate;
  }

  return settings.fundEtfTaxRate;
}

function calculateStampDuty(base, settings) {
  let duty = base * settings.stampDutyRate;

  if (settings.stampDutyMin !== undefined) {
    duty = Math.max(duty, settings.stampDutyMin);
  }

  if (settings.stampDutyMax !== undefined) {
    duty = Math.min(duty, settings.stampDutyMax);
  }

  return Math.max(0, duty);
}

function taxGain(gain, rate, lossState, settings) {
  if (gain <= 0) {
    return { tax: 0, usedLoss: 0 };
  }

  let taxableGain = gain;
  let usedLoss = 0;

  if (settings.allowLossOffset && lossState.available > 0) {
    const offsettableGain = gain * settings.offsettableGainPercentage;
    usedLoss = Math.min(lossState.available, offsettableGain);
    taxableGain = gain - usedLoss;
    lossState.available -= usedLoss;
  }

  return {
    tax: Math.max(0, taxableGain * rate),
    usedLoss
  };
}

function simulateInvestment(input, settings, method = "compound") {
  const months = input.years * 12;
  const netAnnualReturnRate = Math.max(-0.999, input.annualReturnRate - input.annualTer);
  const grossMonthlyRate =
    input.annualRateConvention === "NOMINAL_MONTHLY"
      ? input.annualReturnRate / 12
      : Math.pow(1 + Math.max(-0.999, input.annualReturnRate), 1 / 12) - 1;
  const terMonthlyRate = input.annualTer / 12;
  const grossDistributionAnnualRate = Math.min(input.annualDistributionYield, Math.max(input.annualReturnRate, 0));
  const distributionAnnualRate = Math.min(
    input.annualDistributionYield,
    Math.max(netAnnualReturnRate, 0)
  );
  const grossCapitalAnnualRate = Math.max(-0.999, input.annualReturnRate - grossDistributionAnnualRate);
  const capitalAnnualRate = Math.max(-0.999, netAnnualReturnRate - distributionAnnualRate);
  const grossCapitalMonthlyRate =
    input.annualRateConvention === "NOMINAL_MONTHLY"
      ? grossCapitalAnnualRate / 12
      : Math.pow(1 + grossCapitalAnnualRate, 1 / 12) - 1;
  const capitalMonthlyRate =
    input.annualRateConvention === "NOMINAL_MONTHLY"
      ? capitalAnnualRate / 12
      : Math.pow(1 + capitalAnnualRate, 1 / 12) - 1;
  const distributionMonthlyRate = distributionAnnualRate / 12;
  const grossDistributionMonthlyRate = grossDistributionAnnualRate / 12;
  const grossCapitalHalfMonthRate = Math.pow(1 + grossCapitalMonthlyRate, 0.5) - 1;
  const capitalHalfMonthRate = Math.pow(1 + capitalMonthlyRate, 0.5) - 1;
  const grossDistributionHalfMonthRate = grossDistributionMonthlyRate / 2;
  const distributionHalfMonthRate = distributionMonthlyRate / 2;
  const terHalfMonthRate = terMonthlyRate / 2;
  const effectiveTaxRate = getEffectiveCapitalGainTaxRate(settings);
  const distributionTaxRate = getDistributionTaxRate(settings, input.instrumentType);

  if (method === "simple") {
    return simulateSimpleInvestment({
      input,
      settings,
      months,
      grossSimpleMonthlyRate: grossMonthlyRate,
      capitalSimpleMonthlyRate: capitalMonthlyRate,
      distributionMonthlyRate,
      terMonthlyRate,
      capitalSimpleHalfMonthRate: capitalHalfMonthRate,
      distributionHalfMonthRate,
      terHalfMonthRate,
      effectiveTaxRate,
      distributionTaxRate
    });
  }

  let grossBalance = input.initialCapital;
  let netBalance = input.initialCapital;
  let totalContributions = input.initialCapital;
  let taxes = 0;
  let distributionsTax = 0;
  let patrimonialTax = 0;
  let capitalGainTax = 0;
  let terCosts = 0;
  const lossState = { available: settings.lossCarryForward };
  const yearly = [{ year: 0, gross: grossBalance, net: netBalance, invested: totalContributions }];

  for (let month = 1; month <= months; month += 1) {
    if (input.contributionTiming === "BEGIN") {
      grossBalance += input.monthlyContribution;
      netBalance += input.monthlyContribution;
      totalContributions += input.monthlyContribution;
    }

    grossBalance *= 1 + grossCapitalMonthlyRate;
    grossBalance += Math.max(0, grossBalance * grossDistributionMonthlyRate);

    const capitalGrowth = netBalance * capitalMonthlyRate;
    const terCost = netBalance * terMonthlyRate;
    let capitalGrowthTax = 0;

    if (settings.taxUnrealizedGainsAnnually && capitalGrowth > 0) {
      const result = taxGain(capitalGrowth, effectiveTaxRate, lossState, settings);
      capitalGrowthTax = result.tax;
      capitalGainTax += capitalGrowthTax;
    }

    netBalance += capitalGrowth - capitalGrowthTax;

    const distribution = Math.max(0, netBalance * distributionMonthlyRate);
    const distributionTax = settings.taxDistributionsAnnually ? distribution * distributionTaxRate : 0;
    distributionsTax += distributionTax;
    netBalance += distribution - distributionTax;
    terCosts += terCost;

    taxes += capitalGrowthTax + distributionTax;

    if (input.contributionTiming === "MID") {
      let grossContribution = input.monthlyContribution * (1 + grossCapitalHalfMonthRate);
      grossContribution += Math.max(0, grossContribution * grossDistributionHalfMonthRate);
      grossBalance += grossContribution;

      let netContribution = input.monthlyContribution;
      const contributionCapitalGrowth = netContribution * capitalHalfMonthRate;
      let contributionCapitalGrowthTax = 0;

      if (settings.taxUnrealizedGainsAnnually && contributionCapitalGrowth > 0) {
        const result = taxGain(contributionCapitalGrowth, effectiveTaxRate, lossState, settings);
        contributionCapitalGrowthTax = result.tax;
        capitalGainTax += contributionCapitalGrowthTax;
      }

      netContribution += contributionCapitalGrowth - contributionCapitalGrowthTax;

      const contributionDistribution = Math.max(0, netContribution * distributionHalfMonthRate);
      const contributionDistributionTax = settings.taxDistributionsAnnually
        ? contributionDistribution * distributionTaxRate
        : 0;

      distributionsTax += contributionDistributionTax;
      netContribution += contributionDistribution - contributionDistributionTax;
      terCosts += input.monthlyContribution * terHalfMonthRate;
      taxes += contributionCapitalGrowthTax + contributionDistributionTax;

      netBalance += netContribution;
      totalContributions += input.monthlyContribution;
    }

    if (input.contributionTiming === "END") {
      grossBalance += input.monthlyContribution;
      netBalance += input.monthlyContribution;
      totalContributions += input.monthlyContribution;
    }

    if (month % 12 === 0) {
      let annualPatrimonialTax = 0;

      if (settings.applyStampDuty) {
        annualPatrimonialTax += calculateStampDuty(netBalance, settings);
      }

      if (settings.applyIvafe) {
        annualPatrimonialTax += Math.max(0, netBalance * settings.ivafeRate);
      }

      netBalance -= annualPatrimonialTax;
      patrimonialTax += annualPatrimonialTax;
      taxes += annualPatrimonialTax;

      yearly.push({
        year: month / 12,
        gross: Math.max(0, grossBalance),
        net: Math.max(0, netBalance),
        invested: totalContributions
      });
    }
  }

  let exitTax = 0;
  const finalGain = Math.max(0, netBalance - totalContributions);
  let taxableExitGain = finalGain;

  if (settings.taxCapitalGainAtExit) {
    const result = taxGain(finalGain, effectiveTaxRate, lossState, settings);
    exitTax = result.tax;
    taxableExitGain = effectiveTaxRate > 0 ? exitTax / effectiveTaxRate : finalGain - result.usedLoss;
    capitalGainTax += exitTax;
    netBalance -= exitTax;
    taxes += exitTax;
  }

  yearly[yearly.length - 1] = {
    ...yearly[yearly.length - 1],
    net: Math.max(0, netBalance),
    invested: totalContributions
  };

  return {
    grossFinalCapital: Math.max(0, grossBalance),
    netFinalCapital: Math.max(0, netBalance),
    investedCapital: totalContributions,
    grossGain: Math.max(0, grossBalance - totalContributions),
    netGain: Math.max(0, netBalance - totalContributions),
    taxableGain: taxableExitGain,
    totalTaxes: taxes,
    effectiveTaxRate,
    yearly,
    breakdown: {
      distributionsTax,
      patrimonialTax,
      capitalGainTax,
      exitTax,
      terCosts,
      remainingLossCarryForward: lossState.available
    }
  };
}

function simulateSimpleInvestment(context) {
  const {
    input,
    settings,
    months,
    grossSimpleMonthlyRate,
    capitalSimpleMonthlyRate,
    distributionMonthlyRate,
    terMonthlyRate,
    capitalSimpleHalfMonthRate,
    distributionHalfMonthRate,
    terHalfMonthRate,
    effectiveTaxRate,
    distributionTaxRate
  } = context;

  let grossPrincipal = input.initialCapital;
  let grossAccruedInterest = 0;
  let netPrincipal = input.initialCapital;
  let netAccruedInterest = 0;
  let totalContributions = input.initialCapital;
  let taxes = 0;
  let distributionsTax = 0;
  let patrimonialTax = 0;
  let capitalGainTax = 0;
  let terCosts = 0;
  const lossState = { available: settings.lossCarryForward };
  const yearly = [{ year: 0, gross: grossPrincipal, net: netPrincipal, invested: totalContributions }];

  for (let month = 1; month <= months; month += 1) {
    if (input.contributionTiming === "BEGIN") {
      grossPrincipal += input.monthlyContribution;
      netPrincipal += input.monthlyContribution;
      totalContributions += input.monthlyContribution;
    }

    grossAccruedInterest += grossPrincipal * grossSimpleMonthlyRate;

    const capitalGrowth = netPrincipal * capitalSimpleMonthlyRate;
    const terCost = netPrincipal * terMonthlyRate;
    let capitalGrowthTax = 0;

    if (settings.taxUnrealizedGainsAnnually && capitalGrowth > 0) {
      const result = taxGain(capitalGrowth, effectiveTaxRate, lossState, settings);
      capitalGrowthTax = result.tax;
      capitalGainTax += capitalGrowthTax;
    }

    netAccruedInterest += capitalGrowth - capitalGrowthTax;

    const distribution = Math.max(0, netPrincipal * distributionMonthlyRate);
    const distributionTax = settings.taxDistributionsAnnually ? distribution * distributionTaxRate : 0;
    distributionsTax += distributionTax;
    netAccruedInterest += distribution - distributionTax;
    terCosts += terCost;

    taxes += capitalGrowthTax + distributionTax;

    if (input.contributionTiming === "MID") {
      grossPrincipal += input.monthlyContribution;
      grossAccruedInterest += input.monthlyContribution * grossSimpleMonthlyRate * 0.5;

      netPrincipal += input.monthlyContribution;
      totalContributions += input.monthlyContribution;

      const contributionCapitalGrowth = input.monthlyContribution * capitalSimpleHalfMonthRate;
      let contributionCapitalGrowthTax = 0;

      if (settings.taxUnrealizedGainsAnnually && contributionCapitalGrowth > 0) {
        const result = taxGain(contributionCapitalGrowth, effectiveTaxRate, lossState, settings);
        contributionCapitalGrowthTax = result.tax;
        capitalGainTax += contributionCapitalGrowthTax;
      }

      netAccruedInterest += contributionCapitalGrowth - contributionCapitalGrowthTax;

      const contributionDistribution = Math.max(0, input.monthlyContribution * distributionHalfMonthRate);
      const contributionDistributionTax = settings.taxDistributionsAnnually
        ? contributionDistribution * distributionTaxRate
        : 0;

      distributionsTax += contributionDistributionTax;
      netAccruedInterest += contributionDistribution - contributionDistributionTax;
      terCosts += input.monthlyContribution * terHalfMonthRate;
      taxes += contributionCapitalGrowthTax + contributionDistributionTax;
    }

    if (input.contributionTiming === "END") {
      grossPrincipal += input.monthlyContribution;
      netPrincipal += input.monthlyContribution;
      totalContributions += input.monthlyContribution;
    }

    if (month % 12 === 0) {
      let annualPatrimonialTax = 0;
      const netBalance = netPrincipal + netAccruedInterest;

      if (settings.applyStampDuty) {
        annualPatrimonialTax += calculateStampDuty(netBalance, settings);
      }

      if (settings.applyIvafe) {
        annualPatrimonialTax += Math.max(0, netBalance * settings.ivafeRate);
      }

      const accruedReduction = Math.min(netAccruedInterest, annualPatrimonialTax);
      netAccruedInterest -= accruedReduction;
      netPrincipal = Math.max(0, netPrincipal - (annualPatrimonialTax - accruedReduction));
      patrimonialTax += annualPatrimonialTax;
      taxes += annualPatrimonialTax;

      yearly.push({
        year: month / 12,
        gross: Math.max(0, grossPrincipal + grossAccruedInterest),
        net: Math.max(0, netPrincipal + netAccruedInterest),
        invested: totalContributions
      });
    }
  }

  let exitTax = 0;
  const finalGain = Math.max(0, netPrincipal + netAccruedInterest - totalContributions);
  let taxableExitGain = finalGain;

  if (settings.taxCapitalGainAtExit) {
    const result = taxGain(finalGain, effectiveTaxRate, lossState, settings);
    exitTax = result.tax;
    taxableExitGain = effectiveTaxRate > 0 ? exitTax / effectiveTaxRate : finalGain - result.usedLoss;
    capitalGainTax += exitTax;
    taxes += exitTax;

    const accruedReduction = Math.min(netAccruedInterest, exitTax);
    netAccruedInterest -= accruedReduction;
    netPrincipal = Math.max(0, netPrincipal - (exitTax - accruedReduction));
  }

  yearly[yearly.length - 1] = {
    ...yearly[yearly.length - 1],
    net: Math.max(0, netPrincipal + netAccruedInterest),
    invested: totalContributions
  };

  return {
    grossFinalCapital: Math.max(0, grossPrincipal + grossAccruedInterest),
    netFinalCapital: Math.max(0, netPrincipal + netAccruedInterest),
    investedCapital: totalContributions,
    grossGain: Math.max(0, grossPrincipal + grossAccruedInterest - totalContributions),
    netGain: Math.max(0, netPrincipal + netAccruedInterest - totalContributions),
    taxableGain: taxableExitGain,
    totalTaxes: taxes,
    effectiveTaxRate,
    yearly,
    breakdown: {
      distributionsTax,
      patrimonialTax,
      capitalGainTax,
      exitTax,
      terCosts,
      remainingLossCarryForward: lossState.available
    }
  };
}

function validate(settings, result) {
  const messages = [];
  const rateFields = [
    ["Aliquota plusvalenze ordinarie", settings.ordinaryCapitalGainTaxRate],
    ["Aliquota titoli di Stato / white list", settings.governmentBondTaxRate],
    ["Aliquota dividendi", settings.dividendTaxRate],
    ["Aliquota cedole corporate", settings.corporateBondCouponTaxRate],
    ["Aliquota interessi conto deposito", settings.depositInterestTaxRate],
    ["Aliquota ETF / fondi", settings.fundEtfTaxRate],
    ["Imposta di bollo annua", settings.stampDutyRate],
    ["IVAFE annua", settings.ivafeRate],
    ["Percentuale di plusvalenza compensabile", settings.offsettableGainPercentage],
    ["Quota ordinaria", settings.ordinaryTaxQuota],
    ["Quota agevolata titoli di Stato", settings.governmentBondTaxQuota]
  ];

  rateFields.forEach(([label, value]) => {
    if (value < 0) {
      messages.push({ type: "error", text: `${label}: il valore non puo essere negativo.` });
    }

    if (value > 1) {
      messages.push({ type: "error", text: `${label}: il valore non puo superare il 100%.` });
    }
  });

  const quotaSum = settings.ordinaryTaxQuota + settings.governmentBondTaxQuota;
  if (Math.abs(quotaSum - 1) > 0.0001) {
    messages.push({
      type: "error",
      text: "La somma tra quota ordinaria e quota titoli di Stato deve essere 100%."
    });
  }

  if (settings.applyStampDuty && settings.applyIvafe && settings.brokerTaxRegime !== "CUSTOM") {
    messages.push({
      type: "error",
      text: "Bollo e IVAFE non devono essere applicate insieme, salvo regime personalizzato."
    });
  }

  if (settings.lossCarryForward < 0) {
    messages.push({ type: "error", text: "Le minusvalenze non possono essere negative." });
  }

  if (settings.remainingLossCarryForwardYears !== undefined && settings.remainingLossCarryForwardYears < 0) {
    messages.push({ type: "error", text: "La durata delle minusvalenze non puo essere negativa." });
  }

  if (
    result.netFinalCapital > result.grossFinalCapital + 0.01 &&
    !(settings.allowLossOffset && settings.lossCarryForward > 0)
  ) {
    messages.push({
      type: "warning",
      text: "Il capitale finale netto supera il capitale lordo. Verifica aliquote, minusvalenze e impostazioni fiscali."
    });
  }

  if (messages.length === 0) {
    messages.push({ type: "ok", text: "Validazioni fiscali completate senza errori." });
  }

  return messages;
}

function renderResults(results) {
  const advantage = results.compound.netFinalCapital - results.simple.netFinalCapital;

  document.querySelector("#compoundGrossFinalCapital").textContent = currencyFormatter.format(
    results.compound.grossFinalCapital
  );
  document.querySelector("#compoundInvestedCapital").textContent = currencyFormatter.format(
    results.compound.investedCapital
  );
  document.querySelector("#compoundGrossGain").textContent = currencyFormatter.format(results.compound.grossGain);
  document.querySelector("#compoundNetGain").textContent = currencyFormatter.format(results.compound.netGain);
  document.querySelector("#compoundTaxableGain").textContent = currencyFormatter.format(
    results.compound.taxableGain
  );
  document.querySelector("#compoundNetFinalCapital").textContent = currencyFormatter.format(
    results.compound.netFinalCapital
  );
  document.querySelector("#simpleGrossFinalCapital").textContent = currencyFormatter.format(
    results.simple.grossFinalCapital
  );
  document.querySelector("#simpleInvestedCapital").textContent = currencyFormatter.format(
    results.simple.investedCapital
  );
  document.querySelector("#simpleGrossGain").textContent = currencyFormatter.format(results.simple.grossGain);
  document.querySelector("#simpleNetGain").textContent = currencyFormatter.format(results.simple.netGain);
  document.querySelector("#simpleTaxableGain").textContent = currencyFormatter.format(results.simple.taxableGain);
  document.querySelector("#simpleNetFinalCapital").textContent = currencyFormatter.format(
    results.simple.netFinalCapital
  );
  document.querySelector("#compoundAdvantage").textContent = currencyFormatter.format(advantage);
  document.querySelector("#compoundTerCosts").textContent = currencyFormatter.format(
    results.compound.breakdown.terCosts
  );
  document.querySelector("#simpleTerCosts").textContent = currencyFormatter.format(
    results.simple.breakdown.terCosts
  );
  document.querySelector("#compoundTotalTaxes").textContent = currencyFormatter.format(results.compound.totalTaxes);
  document.querySelector("#simpleTotalTaxes").textContent = currencyFormatter.format(results.simple.totalTaxes);
  document.querySelector("#effectiveTaxRate").textContent = percentFormatter.format(results.compound.effectiveTaxRate);
  renderChart(results);
}

function renderValidation(messages) {
  validationList.innerHTML = "";

  messages.forEach((message) => {
    const item = document.createElement("div");
    item.className = `validation-item ${message.type}`;
    item.textContent = message.text;
    validationList.append(item);
  });
}

function renderChart(results) {
  const compoundSeries = results.compound.yearly;
  const points = compoundSeries.filter((point) => point.year > 0);
  const simplePoints = results.simple.yearly.filter((point) => point.year > 0);
  const svg = document.querySelector("#growthChart");
  const width = 920;
  const height = 380;
  const padding = { top: 28, right: 24, bottom: 72, left: 78 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...points.map((point) => point.gross), ...simplePoints.map((point) => point.gross), 1);
  const barGap = 5;
  const barWidth = Math.max(5, Math.min(22, chartWidth / Math.max(points.length, 1) - barGap));
  const slotWidth = chartWidth / Math.max(points.length, 1);
  const x = (index) => padding.left + index * slotWidth + (slotWidth - barWidth) / 2;
  const y = (value) => padding.top + chartHeight - (value / maxValue) * chartHeight;
  const initialCapital = compoundSeries[0]?.invested ?? 0;
  const labelEvery = points.length <= 20 ? 1 : Math.ceil(points.length / 20);

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const lineY = padding.top + ratio * chartHeight;
    const value = maxValue * (1 - ratio);
    return `
      <line x1="${padding.left}" y1="${lineY}" x2="${width - padding.right}" y2="${lineY}" stroke="#dce3ea" />
      <text x="12" y="${lineY + 4}" fill="#637083" font-size="12">${currencyFormatter.format(value)}</text>
    `;
  }).join("");

  const bars = points
    .map((point, index) => {
      const invested = point.invested ?? 0;
      const initialSegment = Math.min(initialCapital, point.gross);
      const contributionSegment = Math.min(Math.max(0, invested - initialCapital), Math.max(0, point.gross - initialSegment));
      const gainSegment = Math.max(0, point.gross - initialSegment - contributionSegment);
      const barX = x(index);
      let stackTop = 0;

      const rect = (value, fill) => {
        const rectHeight = (value / maxValue) * chartHeight;
        const rectY = padding.top + chartHeight - stackTop - rectHeight;
        stackTop += rectHeight;
        return `<rect x="${barX.toFixed(2)}" y="${rectY.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(0, rectHeight).toFixed(2)}" fill="${fill}"></rect>`;
      };

      const label =
        index % labelEvery === 0 || index === points.length - 1
          ? `<text x="${(barX + barWidth / 2).toFixed(2)}" y="${height - 28}" fill="#637083" font-size="11" text-anchor="end" transform="rotate(-45 ${(barX + barWidth / 2).toFixed(2)} ${height - 28})">Anno ${point.year}</text>`
          : "";

      return `
        ${rect(initialSegment, "#f97316")}
        ${rect(contributionSegment, "#f6c24a")}
        ${rect(gainSegment, "#95cbd2")}
        ${label}
      `;
    })
    .join("");

  const simplePath = simplePoints
    .map((point, index) => {
      const pointX = x(index) + barWidth / 2;
      return `${index === 0 ? "M" : "L"} ${pointX.toFixed(2)} ${y(point.gross).toFixed(2)}`;
    })
    .join(" ");

  const simpleDots = simplePoints
    .map((point, index) => {
      const pointX = x(index) + barWidth / 2;
      return `<circle cx="${pointX.toFixed(2)}" cy="${y(point.gross).toFixed(2)}" r="3.4" fill="#9b1c1c"></circle>`;
    })
    .join("");

  const hitAreas = points
    .map((point, index) => {
      const areaX = padding.left + index * slotWidth;
      return `<rect class="chart-hit-area" data-index="${index}" x="${areaX.toFixed(2)}" y="${padding.top}" width="${slotWidth.toFixed(2)}" height="${chartHeight}" fill="transparent" pointer-events="all"></rect>`;
    })
    .join("");

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    ${gridLines}
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartHeight}" stroke="#c9d3dd"></line>
    <line x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${width - padding.right}" y2="${padding.top + chartHeight}" stroke="#c9d3dd"></line>
    ${bars}
    <path d="${simplePath}" fill="none" stroke="#9b1c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    ${simpleDots}
    ${hitAreas}
    <text x="18" y="${padding.top + chartHeight / 2}" fill="#637083" font-size="12" font-weight="700" text-anchor="middle" transform="rotate(-90 18 ${padding.top + chartHeight / 2})">EUR</text>
  `;

  setupChartTooltip(points, simplePoints, initialCapital);
}

function setupChartTooltip(points, simplePoints, initialCapital) {
  const tooltip = document.querySelector("#chartTooltip");
  const chartWrap = document.querySelector(".chart-wrap");
  const hitAreas = document.querySelectorAll(".chart-hit-area");

  if (!tooltip || !chartWrap) {
    return;
  }

  hitAreas.forEach((area) => {
    area.addEventListener("pointermove", (event) => {
      const index = Number(area.dataset.index);
      const compoundPoint = points[index];
      const simplePoint = simplePoints[index];

      if (!compoundPoint || !simplePoint) {
        return;
      }

      const invested = compoundPoint.invested ?? 0;
      const contributions = Math.max(0, invested - initialCapital);

      tooltip.innerHTML = `
        <strong>Anno ${compoundPoint.year}</strong>
        ${tooltipRow("simple", "Interesse semplice", simplePoint.gross)}
        ${tooltipRow("initial", "Capitale iniziale", initialCapital)}
        ${tooltipRow("contributions", "Versamenti cumulati", contributions)}
        ${tooltipRow("compound", "Interesse composto", compoundPoint.gross)}
      `;

      tooltip.classList.add("is-visible");
      tooltip.setAttribute("aria-hidden", "false");

      const wrapRect = chartWrap.getBoundingClientRect();
      const tooltipWidth = tooltip.offsetWidth || 190;
      const tooltipHeight = tooltip.offsetHeight || 120;
      const left = clamp(event.clientX - wrapRect.left + 14, 8, wrapRect.width - tooltipWidth - 8);
      const top = clamp(event.clientY - wrapRect.top - tooltipHeight - 12, 8, wrapRect.height - tooltipHeight - 8);

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });

    area.addEventListener("pointerleave", hideChartTooltip);
  });

  chartWrap.addEventListener("pointerleave", hideChartTooltip);

  function hideChartTooltip() {
    tooltip.classList.remove("is-visible");
    tooltip.setAttribute("aria-hidden", "true");
  }
}

function tooltipRow(marker, label, value) {
  return `
    <div class="tooltip-row">
      <span class="tooltip-marker ${marker}"></span>
      <span>${label}</span>
      <span>${currencyFormatter.format(value)}</span>
    </div>
  `;
}

function renderScenarios() {
  scenarioList.innerHTML = "";

  if (scenarios.length === 0) {
    const empty = document.createElement("p");
    empty.className = "help-text";
    empty.textContent = "Duplica uno scenario per confrontare impostazioni fiscali diverse.";
    scenarioList.append(empty);
    return;
  }

  scenarios.forEach((scenario, index) => {
    const row = document.createElement("div");
    row.className = "scenario-row";
    row.innerHTML = `
      <div>
        <strong>${scenario.name}</strong>
        <span>${currencyFormatter.format(scenario.netFinalCapital)} netto, ${percentFormatter.format(scenario.effectiveTaxRate)} aliquota media</span>
      </div>
      <button class="secondary-button" type="button" data-load-scenario="${index}">Carica</button>
    `;
    scenarioList.append(row);
  });
}

function buildScenarioName() {
  if (taxSettings.country === "CUSTOM") {
    return "Scenario personalizzato";
  }

  if (taxSettings.brokerTaxRegime === "ADMINISTERED") {
    return "Scenario Italia - Regime amministrato";
  }

  if (taxSettings.brokerTaxRegime === "DECLARATIVE") {
    return "Scenario Italia - Broker estero";
  }

  if (taxSettings.brokerTaxRegime === "MANAGED") {
    return "Scenario Italia - Regime gestito";
  }

  return "Scenario fiscale";
}

function saveTaxScenario() {
  const name = window.prompt("Nome scenario fiscale", buildScenarioName());
  if (!name) {
    return;
  }

  const payload = {
    name,
    taxSettings: cloneTaxSettings(taxSettings)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadTaxScenario() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    renderValidation([{ type: "warning", text: "Nessuno scenario fiscale salvato nel browser." }]);
    return;
  }

  try {
    const payload = JSON.parse(raw);
    taxSettings = {
      ...cloneTaxSettings(italianDefaultTaxSettings),
      ...payload.taxSettings
    };
    manualTaxEditing = true;
    renderTaxFields();
    update();
  } catch {
    renderValidation([{ type: "error", text: "Scenario fiscale salvato non leggibile." }]);
  }
}

function duplicateScenario() {
  const input = readInvestmentSettings();
  const result = simulateInvestment(input, taxSettings, "compound");
  scenarios = [
    ...scenarios,
    {
      name: buildScenarioName(),
      taxSettings: cloneTaxSettings(taxSettings),
      netFinalCapital: result.netFinalCapital,
      effectiveTaxRate: result.effectiveTaxRate
    }
  ];
  renderScenarios();
}

function update() {
  const input = readInvestmentSettings();

  if (taxSettings.brokerTaxRegime === "DECLARATIVE") {
    applyRegimeDefaults(input);
    renderTaxFields();
  }

  const results = {
    compound: simulateInvestment(input, taxSettings, "compound"),
    simple: simulateInvestment(input, taxSettings, "simple")
  };
  renderResults(results);
  renderValidation(validate(taxSettings, results.compound));
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

form.addEventListener("input", (event) => {
  if (event.target.matches("[data-tax-field]")) {
    handleTaxInputChange(event);
    return;
  }

  update();
});

form.addEventListener("change", (event) => {
  if (event.target === taxCountry) {
    if (taxCountry.value === "IT") {
      taxSettings = cloneTaxSettings(italianDefaultTaxSettings);
      manualTaxEditing = false;
    } else {
      taxSettings.country = "CUSTOM";
      manualTaxEditing = true;
    }

    renderTaxFields();
    update();
    return;
  }

  if (event.target.matches("[data-tax-field]")) {
    handleTaxInputChange(event);
    return;
  }

  update();
});

manualTaxToggle.addEventListener("click", () => {
  const isCurrentlyEditable = manualTaxEditing || taxSettings.country === "CUSTOM";

  if (isCurrentlyEditable) {
    taxSettings = cloneTaxSettings(italianDefaultTaxSettings);
    manualTaxEditing = false;
  } else {
    manualTaxEditing = true;
    taxSettings.country = "CUSTOM";
  }

  renderTaxFields();
  update();
});

document.querySelector("#resetItalianTax").addEventListener("click", () => {
  taxSettings = cloneTaxSettings(italianDefaultTaxSettings);
  manualTaxEditing = false;
  renderTaxFields();
  update();
});

document.querySelector("#saveTaxScenario").addEventListener("click", saveTaxScenario);
document.querySelector("#loadTaxScenario").addEventListener("click", loadTaxScenario);
document.querySelector("#duplicateScenario").addEventListener("click", duplicateScenario);

scenarioList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-load-scenario]");
  if (!button) {
    return;
  }

  const scenario = scenarios[Number(button.dataset.loadScenario)];
  taxSettings = cloneTaxSettings(scenario.taxSettings);
  manualTaxEditing = true;
  renderTaxFields();
  update();
});

renderTaxFields();
renderScenarios();
setMode(currentMode);
