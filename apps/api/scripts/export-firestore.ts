import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { importPKCS8, SignJWT } from "jose";

type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };
const collections = ["users", "carts", "favorites", "reviews", "orders", "products", "storefront"];

function decode(value: any): any {
  if (!value || typeof value !== "object") return value;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, entry]) => [key, decode(entry)]));
  return value;
}

async function accessToken(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000); const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform" }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(account.client_email).setSubject(account.client_email).setAudience(account.token_uri || "https://oauth2.googleapis.com/token").setIssuedAt(now).setExpirationTime(now + 3600).sign(key);
  const response = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const body: any = await response.json(); if (!response.ok || !body.access_token) throw new Error(body.error_description || "Could not authorize Firebase export"); return body.access_token as string;
}

async function listCollection(projectId: string, name: string, token: string) {
  const documents: any[] = []; let pageToken = "";
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${name}`); url.searchParams.set("pageSize", "300"); if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); const body: any = await response.json(); if (!response.ok) throw new Error(body.error?.message || `Could not export ${name}`);
    documents.push(...(body.documents || []).map((document: any) => ({ id: document.name.split("/").pop(), data: Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)])), createTime: document.createTime, updateTime: document.updateTime })));
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function main() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.argv[2]; if (!serviceAccountPath) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_PATH to the downloaded service-account JSON file");
  const account = JSON.parse(await readFile(resolve(serviceAccountPath), "utf8")) as ServiceAccount; const token = await accessToken(account); const output: Record<string, unknown> = { projectId: account.project_id, exportedAt: new Date().toISOString(), collections: {} };
  for (const name of collections) { const rows = await listCollection(account.project_id, name, token); (output.collections as Record<string, unknown>)[name] = rows; console.log(`${name}: ${rows.length}`); }
  const outputPath = resolve(process.argv[3] || "../../.migration/firestore-export.json"); await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, JSON.stringify(output, null, 2)); console.log(`Export saved to ${outputPath}`);
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
