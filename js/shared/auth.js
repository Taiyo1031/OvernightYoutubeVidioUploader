import { COOKIE_KEYS, LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "./constants.js";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
let rememberPreferenceMigrated = false;

function readCookie(name) {
  try {
    const cookiePairs = document.cookie ? document.cookie.split("; ") : [];
    for (const pair of cookiePairs) {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex < 0) continue;

      const key = pair.slice(0, separatorIndex);
      if (key !== name) continue;

      return decodeURIComponent(pair.slice(separatorIndex + 1));
    }
  } catch {}
  return "";
}

function writeCookie(name, value, maxAgeSeconds = COOKIE_MAX_AGE_SECONDS) {
  try {
    document.cookie = [
      `${name}=${encodeURIComponent(value)}`,
      `Max-Age=${maxAgeSeconds}`,
      "Path=/",
      "SameSite=Lax",
      "Secure",
    ].join("; ");
  } catch {}
}

function deleteCookie(name) {
  try {
    document.cookie = [
      `${name}=`,
      "Max-Age=0",
      "Path=/",
      "SameSite=Lax",
      "Secure",
    ].join("; ");
  } catch {}
}

function migrateLegacyRememberPreference() {
  if (rememberPreferenceMigrated) return;
  rememberPreferenceMigrated = true;

  try {
    if (readCookie(COOKIE_KEYS.REMEMBER_SIGNIN)) return;

    const legacyValue = localStorage.getItem(LEGACY_STORAGE_KEYS.REMEMBER_SIGNIN);
    if (legacyValue === null) return;

    writeCookie(COOKIE_KEYS.REMEMBER_SIGNIN, legacyValue === "0" ? "0" : "1");
    localStorage.removeItem(LEGACY_STORAGE_KEYS.REMEMBER_SIGNIN);
  } catch {}
}

export function getRememberEnabled() {
  migrateLegacyRememberPreference();
  return readCookie(COOKIE_KEYS.REMEMBER_SIGNIN) === "1";
}

export function setRememberEnabled(value) {
  writeCookie(COOKIE_KEYS.REMEMBER_SIGNIN, value ? "1" : "0");
}

export function clearRememberSigninCookies() {
  deleteCookie(COOKIE_KEYS.REMEMBER_SIGNIN);
  deleteCookie(COOKIE_KEYS.LAST_EMAIL);
}

export function getCachedSigninEmail() {
  return readCookie(COOKIE_KEYS.LAST_EMAIL);
}

export function setCachedSigninEmail(email) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) {
    deleteCookie(COOKIE_KEYS.LAST_EMAIL);
    return;
  }
  writeCookie(COOKIE_KEYS.LAST_EMAIL, normalized);
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
