/**
 * Utility functions to format ISO/UTC database date and time strings
 * into clean, user-friendly Pakistan Local Date & Time (PKT, UTC+5).
 * Day end is strictly at 12:00 AM Midnight (00:00) Pakistan Time.
 */

/**
 * Returns 'YYYY-MM-DD' representing the date in Pakistan Local Time (Asia/Karachi, UTC+5).
 */
export function getPKTDate(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const pkt = new Date(utc + 5 * 3600000);
    return pkt.toISOString().slice(0, 10);
  }
}

/**
 * Parses any date/timestamp string into Pakistan Local Date 'YYYY-MM-DD'.
 */
export function parseDateToPKT(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return "";
    return getPKTDate(dateInput);
  }

  const str = String(dateInput).trim();
  if (!str) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const isoStr = str.includes("T") ? str : str.replace(" ", "T");
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) {
    const dFallback = new Date(str);
    if (isNaN(dFallback.getTime())) return str.slice(0, 10);
    return getPKTDate(dFallback);
  }
  return getPKTDate(d);
}

export function formatLocalDateTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    let normalized = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(normalized)) {
      normalized = normalized.replace(" ", "T") + "Z";
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
      normalized = normalized + "Z";
    }

    const d = new Date(normalized);
    if (isNaN(d.getTime())) return dateStr;

    return d.toLocaleString("en-PK", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export function formatLocalDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    let normalized = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(normalized)) {
      normalized = normalized.replace(" ", "T") + "Z";
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
      normalized = normalized + "Z";
    }

    const d = new Date(normalized);
    if (isNaN(d.getTime())) return dateStr;

    return d.toLocaleDateString("en-PK", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatLocalTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    let normalized = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(normalized)) {
      normalized = normalized.replace(" ", "T") + "Z";
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
      normalized = normalized + "Z";
    }

    const d = new Date(normalized);
    if (isNaN(d.getTime())) return dateStr;

    return d.toLocaleTimeString("en-PK", {
      timeZone: "Asia/Karachi",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}
