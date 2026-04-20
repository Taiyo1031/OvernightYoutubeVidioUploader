export function escapeHtml(value) {
  return (value ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function pad3(n) {
  return String(n).padStart(3, "0");
}

export function pad4(n) {
  return String(n).padStart(4, "0");
}

export function nowISO() {
  return new Date().toISOString();
}

export function toTokyoParts(dateObj) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dateObj);

  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return { year, month, day };
}

export function ymdTokyo(dateObj) {
  const { year, month, day } = toTokyoParts(dateObj);
  return `${year}-${month}-${day}`;
}

export function yyyymmddTokyo() {
  const { year, month, day } = toTokyoParts(new Date());
  return `${year}${month}${day}`;
}

export function normalizeDateInputToYyyymmdd(value) {
  const source = (value || "").trim();
  if (!source) return "";

  const withSeparators = source.match(/^([0-9]{4})[-/]([0-9]{1,2})[-/]([0-9]{1,2})$/);
  if (withSeparators) {
    const year = withSeparators[1];
    const month = String(Number(withSeparators[2])).padStart(2, "0");
    const day = String(Number(withSeparators[3])).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  const compact = source.match(/^([0-9]{4})([0-9]{2})([0-9]{2})$/);
  if (compact) return source;

  return "";
}

export function toTokyo(dtIso) {
  if (!dtIso) return "";
  try {
    const date = new Date(dtIso);
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dtIso;
  }
}

export function formatBytes(bytes) {
  const numeric = Number(bytes || 0);
  if (!isFinite(numeric) || numeric <= 0) return "-";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = numeric;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

export function formatETA(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "-";
  const rounded = Math.ceil(seconds);
  const minutes = String(Math.floor(rounded / 60)).padStart(2, "0");
  const secs = String(rounded % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
}

export function formatSpeed(bytesPerSec) {
  if (!isFinite(bytesPerSec) || bytesPerSec <= 0) return "-";
  const mbps = bytesPerSec / (1024 * 1024);
  return `${mbps.toFixed(2)} MB/s`;
}
