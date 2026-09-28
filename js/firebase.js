import { createAuth, startSessionMonitor } from "./auth-api.js?v=20260928-2";

const auth = createAuth();

const db = { kind: "customer", auth };

window.auth = auth;

window.db = db;

auth.ready.then(() => startSessionMonitor(auth));

console.log("MPWR services connected.");
