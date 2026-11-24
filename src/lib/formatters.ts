/**
 * Ameer Perfumes ERP — Mathematical & Financial Formatting Engine
 * Adheres strictly to Phase 1, Phase 2.3.1, and Phase 3 specifications.
 */

/**
 * Format currency from integer paisa to PKR display.
 * 1 PKR = 100 Paisa.
 * Example: 189474 paisa -> "Rs. 1,894.74"
 */
export function formatPKR(paisa: number): string {
  const rupees = Math.round(paisa / 100);
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(rupees)
    .replace("PKR", "Rs.");
}

export const formatPaisaToRupees = formatPKR;

/**
 * Format volume in milliliters.
 */
export function formatMl(ml: number): string {
  return `${ml.toLocaleString("en-PK", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ml`;
}

/**
 * Format mass in grams.
 */
export function formatGrams(g: number): string {
  return `${g.toLocaleString("en-PK", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`;
}

/**
 * Manufacturing Batch Yield Cost Absorption Calculator.
 * Input total raw material cost (in paisa) and saleable units released.
 * Any evaporation or assembly defect is absorbed 100% into saleable units.
 */
export function calculateBatchYieldCost(totalCostPaisa: number, saleableUnits: number) {
  if (saleableUnits <= 0) {
    throw new Error("Saleable units must be greater than zero");
  }
  const exactCostPerUnitPaisa = totalCostPaisa / saleableUnits;
  const roundedCostPerUnitPaisa = Math.round(exactCostPerUnitPaisa);
  const capitalizedValuePaisa = roundedCostPerUnitPaisa * saleableUnits;
  const roundingVariancePaisa = capitalizedValuePaisa - totalCostPaisa;

  return {
    exactCostPerUnitPaisa,
    roundedCostPerUnitPaisa,
    capitalizedValuePaisa,
    roundingVariancePaisa,
  };
}

/**
 * Attar Oil Density, Mass & Margin Engine.
 * Density is in milli-density (mg/ml, thousandths of g/ml): 1050 = 1.050 g/ml.
 * Mass formula: Mass (g) = (Volume (ml) * Density (mg/ml)) / 1000
 */
export function calculateAttarDecant(
  volumeMl: number,
  densityMgPerMl: number,
  costPricePerMlPaisa: number,
  retailPricePerMlPaisa: number
) {
  const massGrams = (volumeMl * densityMgPerMl) / 1000;
  const totalCostPaisa = Math.round(volumeMl * costPricePerMlPaisa);
  const totalRetailPaisa = Math.round(volumeMl * retailPricePerMlPaisa);
  const grossProfitPaisa = totalRetailPaisa - totalCostPaisa;
  const marginPercentage = totalRetailPaisa > 0 ? (grossProfitPaisa / totalRetailPaisa) * 100 : 0;
  const markupPercentage = totalCostPaisa > 0 ? (grossProfitPaisa / totalCostPaisa) * 100 : 0;

  return {
    volumeMl,
    densityMgPerMl,
    massGrams,
    totalCostPaisa,
    totalRetailPaisa,
    grossProfitPaisa,
    marginPercentage,
    markupPercentage,
  };
}
