/**
 * Utility functions to format ISO/UTC database date and time strings
 * into clean, user-friendly local date & time according to the user's local timezone.
 */

export function formatLocalDateTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    let normalized = dateStr.trim();
    // If it is in SQLite format "YYYY-MM-DD HH:MM:SS" without Z or timezone offset,
    // append Z so Date parses it as UTC instead of ambiguous local
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(normalized)) {
      normalized = normalized.replace(" ", "T") + "Z";
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
      normalized = normalized + "Z";
    }

    const d = new Date(normalized);
    if (isNaN(d.getTime())) return dateStr;

    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
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

    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
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

    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}
