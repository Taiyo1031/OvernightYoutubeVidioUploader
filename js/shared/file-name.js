import { pad4 } from "./format.js";

export function sanitizeLabel(value) {
  return (value || "")
    .trim()
    .replace(/[\s\u3000]+/g, "-")
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 40);
}

export function normalizeProjectId(value) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getFileExt(originalName) {
  const index = (originalName || "").lastIndexOf(".");
  if (index <= 0) return "";
  const ext = originalName.slice(index).toLowerCase();
  return ext.replace(/[^a-z0-9.]/g, "");
}

export function buildUploadFileName({ projectId, recordingDate, seq, label, ext }) {
  return `${projectId}_${recordingDate}_${pad4(seq)}_${label}${ext}`;
}

export function extractYyyymmddFromFileName(name) {
  const match = (name || "").match(/^[^_]+_([0-9]{8})_[0-9]{4}(?:_.+)?\.[^.]+$/);
  return match ? match[1] : "";
}

export function extractLabelFromFileName(name) {
  const match = (name || "").match(/^[^_]+_[0-9]{8}_[0-9]{4}_(.+)\.[^.]+$/);
  return match ? match[1] : "";
}

export function extractExtFromFileName(name) {
  const index = (name || "").lastIndexOf(".");
  return index >= 0 ? name.slice(index) : "";
}
