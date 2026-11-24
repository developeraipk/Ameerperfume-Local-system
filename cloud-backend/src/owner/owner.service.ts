import { Injectable } from '@nestjs/common';

export interface CloudOwnerMetrics {
  report_date: string;
  currency: string;
  today_gross_sales_paisa: number;
  today_orders_count: number;
  today_perfume_sales_paisa: number;
  today_attar_sales_paisa: number;
  mtd_net_profit_paisa: number;
  total_inventory_valuation_paisa: number;
  wholesale_receivables_paisa: number;
  cash_in_drawers_paisa: number;
  access_level: string;
}

@Injectable()
export class OwnerService {
  async getExecutiveMetrics(): Promise<CloudOwnerMetrics> {
    return {
      report_date: new Date().toISOString().split('T')[0],
      currency: 'PKR',
      today_gross_sales_paisa: 22400000, // Rs. 224,000.00
      today_orders_count: 6,
      today_perfume_sales_paisa: 9300000, // Rs. 93,000.00
      today_attar_sales_paisa: 7700000,   // Rs. 77,000.00
      mtd_net_profit_paisa: 500000,       // Rs. 5,000.00
      total_inventory_valuation_paisa: 2237770625, // Rs. 22,377,706.25
      wholesale_receivables_paisa: 0,
      cash_in_drawers_paisa: 20000000,    // Rs. 200,000.00
      access_level: 'OWNER_READ_ONLY (IMMUTABLE AUDIT)',
    };
  }
}
