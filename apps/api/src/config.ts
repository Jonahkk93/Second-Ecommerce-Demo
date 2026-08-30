export function validateEnvironment(config: Record<string, unknown>) {
  for (const key of ["DATABASE_URL", "REDIS_URL", "JWT_SECRET"]) {
    if (!String(config[key] || "").trim()) throw new Error(`${key} is required`);
  }
  if (String(config.JWT_SECRET).length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  if (config.NODE_ENV === "production") {
    for (const key of ["WEB_ORIGIN", "GOOGLE_MAPS_API_KEY", "PESAPAL_CONSUMER_KEY", "PESAPAL_CONSUMER_SECRET", "PESAPAL_CALLBACK_URL", "RESEND_API_KEY", "AUTH_EMAIL_FROM", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"]) {
      if (!String(config[key] || "").trim()) throw new Error(`${key} is required in production`);
    }
    if (!["sandbox", "production"].includes(String(config.PESAPAL_ENV || ""))) throw new Error("PESAPAL_ENV must be sandbox or production");
  }
  return config;
}
