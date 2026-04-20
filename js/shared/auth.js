import { STORAGE_KEYS } from "./constants.js";

export function getRememberEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEYS.REMEMBER_SIGNIN) !== "0";
  } catch {
    return true;
  }
}

export function setRememberEnabled(value) {
  try {
    localStorage.setItem(STORAGE_KEYS.REMEMBER_SIGNIN, value ? "1" : "0");
  } catch {}
}

export async function fetchMyEmail(token) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.email || "";
}

export function isPermissionDeniedError(err) {
  const message = err?.message || String(err || "");
  return /PERMISSION_DENIED|does not have permission|"code"\s*:\s*403/i.test(message);
}

export function isAdminEmail(email, adminEmail) {
  return (email || "").toLowerCase() === (adminEmail || "").toLowerCase();
}

export function loadAllowedEmails(fallback = []) {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ALLOWED_EMAILS);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return fallback;
}

export function saveAllowedEmails(emails) {
  try {
    localStorage.setItem(STORAGE_KEYS.ALLOWED_EMAILS, JSON.stringify(emails));
    return true;
  } catch {
    return false;
  }
}
