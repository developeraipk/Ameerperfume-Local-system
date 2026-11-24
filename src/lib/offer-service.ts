import {
  PromotionalOffer,
  PromotionalOfferDto,
  OfferItemSpec,
} from "@/types/offers";
import {
  getPromotionalOffers,
  savePromotionalOffer,
  deletePromotionalOffer,
} from "./tauri-bridge";

const LOCAL_STORAGE_KEY = "ameer_promotional_offers_v1";

export function formatTimeRemaining(endDateStr: string): {
  isExpired: boolean;
  text: string;
  badgeClass: string;
} {
  const end = new Date(endDateStr).getTime();
  const now = Date.now();
  const diffMs = end - now;

  if (diffMs <= 0) {
    return {
      isExpired: true,
      text: "Expired",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;

  if (diffDays >= 1) {
    return {
      isExpired: false,
      text: `Ends in ${diffDays}d ${remHours}h`,
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    };
  } else if (diffHours >= 1) {
    return {
      isExpired: false,
      text: `Ends in ${diffHours}h`,
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200 animate-pulse",
    };
  } else {
    const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return {
      isExpired: false,
      text: `Ends in ${diffMins}m`,
      badgeClass: "bg-rose-100 text-rose-800 border-rose-300 animate-pulse",
    };
  }
}

export function dtoToOffer(dto: PromotionalOfferDto): PromotionalOffer {
  let items: OfferItemSpec[] = [];
  try {
    items = JSON.parse(dto.items_json);
  } catch (e) {
    console.error("Failed to parse items_json for offer", dto.offer_id, e);
  }

  return {
    offer_id: dto.offer_id,
    title: dto.title,
    tag: dto.tag,
    description: dto.description || undefined,
    items,
    regular_total: Math.round(dto.regular_total_paisa / 100),
    bundle_price: Math.round(dto.bundle_price_paisa / 100),
    savings: Math.round(dto.savings_paisa / 100),
    discount_percent: dto.discount_percent,
    total_cost: Math.round(dto.total_cost_paisa / 100),
    start_date: dto.start_date,
    end_date: dto.end_date,
    is_active: dto.is_active,
    created_at: dto.created_at,
    updated_at: dto.updated_at || undefined,
  };
}

export function offerToDto(offer: PromotionalOffer): PromotionalOfferDto {
  return {
    offer_id: offer.offer_id,
    title: offer.title,
    tag: offer.tag,
    description: offer.description || null,
    items_json: JSON.stringify(offer.items),
    regular_total_paisa: Math.round(offer.regular_total * 100),
    bundle_price_paisa: Math.round(offer.bundle_price * 100),
    savings_paisa: Math.round(offer.savings * 100),
    discount_percent: Math.round(offer.discount_percent),
    total_cost_paisa: Math.round((offer.total_cost || 0) * 100),
    start_date: offer.start_date,
    end_date: offer.end_date,
    is_active: offer.is_active,
    created_at: offer.created_at || new Date().toISOString(),
    updated_at: offer.updated_at || new Date().toISOString(),
  };
}

export function getSeedOffers(): PromotionalOffer[] {
  const now = new Date();
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return [
    {
      offer_id: "OFFER-ATTAR-TRIO",
      title: "Artisan Attar 6ml Trio",
      tag: "3-DAY FLASH SALE",
      description: "Any 3 assorted pure concentrated attar oils (6ml bottles). Regular Rs. 3,000, now Rs. 2,300.",
      items: [
        {
          item_type: "ATTAR",
          name: "Dehn Al Oudh (Cambodi)",
          size_label: "6ml",
          quantity: 1,
          unit_regular_price: 1000,
          unit_cost_price: 450,
        },
        {
          item_type: "ATTAR",
          name: "Taif Rose Premium",
          size_label: "6ml",
          quantity: 1,
          unit_regular_price: 1000,
          unit_cost_price: 450,
        },
        {
          item_type: "ATTAR",
          name: "White Musk Imperial",
          size_label: "6ml",
          quantity: 1,
          unit_regular_price: 1000,
          unit_cost_price: 450,
        },
      ],
      regular_total: 3000,
      bundle_price: 2300,
      savings: 700,
      discount_percent: 23,
      total_cost: 1350,
      start_date: now.toISOString(),
      end_date: threeDaysLater.toISOString(),
      is_active: true,
      created_at: now.toISOString(),
    },
    {
      offer_id: "OFFER-PERFUME-DUO",
      title: "Luxury Perfume EDP Duo",
      tag: "WEEKEND SPECIAL",
      description: "Any 2 French spray perfumes (50ml). Regular Rs. 5,000, festive bundle deal Rs. 4,200.",
      items: [
        {
          item_type: "PERFUME",
          name: "Ameer Royal Leather",
          size_label: "50ml",
          quantity: 1,
          unit_regular_price: 2500,
          unit_cost_price: 1200,
        },
        {
          item_type: "PERFUME",
          name: "Savage Noir",
          size_label: "50ml",
          quantity: 1,
          unit_regular_price: 2500,
          unit_cost_price: 1200,
        },
      ],
      regular_total: 5000,
      bundle_price: 4200,
      savings: 800,
      discount_percent: 16,
      total_cost: 2400,
      start_date: now.toISOString(),
      end_date: sevenDaysLater.toISOString(),
      is_active: true,
      created_at: now.toISOString(),
    },
  ];
}

export async function loadAllOffers(): Promise<PromotionalOffer[]> {
  try {
    const dtos = await getPromotionalOffers();
    if (dtos && dtos.length > 0) {
      return dtos.map(dtoToOffer);
    }
  } catch (err) {
    console.warn("Could not load offers from SQLite backend, checking fallback", err);
  }

  // If user reset/cleared database, do not revive old seed offers
  const isCleared = localStorage.getItem("ameer_database_cleared") === "true";
  if (isCleared) {
    return [];
  }

  // Check localStorage
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) {
    try {
      const parsed: PromotionalOffer[] = JSON.parse(saved);
      if (parsed.length > 0) return parsed;
    } catch (e) {
      console.error("Failed to parse cached offers", e);
    }
  }

  return [];
}

export async function persistOffer(offer: PromotionalOffer): Promise<boolean> {
  localStorage.removeItem("ameer_database_cleared");
  const dto = offerToDto(offer);
  let ok = false;
  try {
    ok = await savePromotionalOffer(dto);
  } catch (err) {
    console.warn("Could not save offer to SQLite backend:", err);
  }

  // Also sync localStorage cache
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    let list: PromotionalOffer[] = cached ? JSON.parse(cached) : [];
    const idx = list.findIndex((x) => x.offer_id === offer.offer_id);
    if (idx >= 0) {
      list[idx] = offer;
    } else {
      list.push(offer);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to sync localStorage for offer", e);
  }

  return ok;
}

export async function removeOffer(offerId: string): Promise<boolean> {
  let ok = false;
  try {
    ok = await deletePromotionalOffer(offerId);
  } catch (err) {
    console.warn("Could not delete offer from SQLite backend:", err);
  }

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      let list: PromotionalOffer[] = JSON.parse(cached);
      list = list.filter((x) => x.offer_id !== offerId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.error("Failed to remove offer from localStorage", e);
  }

  return ok;
}
