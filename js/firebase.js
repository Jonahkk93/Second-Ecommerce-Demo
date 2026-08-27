import { createAuth } from "./auth-api.js";

const auth = createAuth();

const db = { kind: "customer", auth };

window.auth = auth;

window.db = db;

console.log("MPWR services connected.");
