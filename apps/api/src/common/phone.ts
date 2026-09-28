export function normalizePhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length >= 9 ? digits.slice(-9) : digits;
}
