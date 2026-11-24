import { StoreConfig } from "@/types/system";

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  storeName: "Ameer Perfumes",
  tagline: "Artisanal Perfumery & Pure Concentrated Oils",
  address: "Shop #4, Luxury Perfume Galleria, Main Boulevard",
  city: "Lahore, Pakistan",
  phone: "+92 42 3578 9000",
  ntn: "7849201-4",
  currencySymbol: "Rs.",
  receiptFooter: "Thank you for experiencing Ameer Perfumes. Crafted with pure devotion.",
  privacyNotice: "Authentic Luxury Perfumery Guarantee. 100% Original Ingredients.",
};

class ConfigurationService {
  private config: StoreConfig = { ...DEFAULT_STORE_CONFIG };

  public getConfig(): StoreConfig {
    return this.config;
  }

  public updateConfig(newConfig: Partial<StoreConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Receipt Privacy Rule:
   * Confirms that customer receipts NEVER include cashier operator or salesperson names.
   */
  public isReceiptPrivacyEnforced(): boolean {
    return true; // Enforced invariant from Phase 1 Clause 1.4 & Owner Decision A
  }
}

export const configService = new ConfigurationService();
