import { createAuth } from "./auth-api.js?v=20260927-1";

const auth = createAuth();

const db = { kind: "customer", auth };

window.auth = auth;

window.db = db;

console.log("MPWR services connected.");
