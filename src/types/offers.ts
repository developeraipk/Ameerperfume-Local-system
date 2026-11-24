export interface OfferItemSpec {
  item_type: 'PERFUME' | 'ATTAR' | 'TESTER';
  product_id?: string; // FinishedProduct UUID if PERFUME
  attar_id?: string;   // Attar UUID if ATTAR
  name: string;
  size_label: string;  // e.g. "50ml", "100ml", "6ml", "12ml", "1 Tola"
  quantity: number;
  unit_regular_price: number; // in PKR rupees
  unit_cost_price?: number;   // in PKR rupees
}

export interface PromotionalOffer {
  offer_id: string;
  title: string;
  tag: string;
  description?: string;
  items: OfferItemSpec[];
  regular_total: number;     // in PKR rupees
  bundle_price: number;      // in PKR rupees
  savings: number;           // in PKR rupees
  discount_percent: number;  // e.g. 23%
  total_cost?: number;       // in PKR rupees
  start_date: string;        // YYYY-MM-DD or ISO
  end_date: string;          // YYYY-MM-DD or ISO
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface PromotionalOfferDto {
  offer_id: string;
  title: string;
  tag: string;
  description?: string | null;
  items_json: string;
  regular_total_paisa: number;
  bundle_price_paisa: number;
  savings_paisa: number;
  discount_percent: number;
  total_cost_paisa: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}
