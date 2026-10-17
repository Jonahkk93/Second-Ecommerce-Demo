import { Equals } from "class-validator";

// Keep in sync with js/legal-policy.js and the archived policy bundle.
export const TERMS_VERSION = "2026-10-17.2";
const PRIVACY_NOTICE_VERSION = "2026-10-17.1";
export class TermsAcceptanceDto {
  @Equals(true, { message: "Please agree to the Terms & Conditions" }) termsAccepted!: boolean;
  @Equals(TERMS_VERSION, { message: "The terms have changed. Reload and review them before continuing" }) termsVersion!: string;
}
export function acceptanceReceipt(source: "registration" | "checkout") {
  return { termsVersion: TERMS_VERSION, privacyNoticeVersion: PRIVACY_NOTICE_VERSION, acceptedAt: new Date().toISOString(), source };
}
