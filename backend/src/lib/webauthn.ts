import type { Request } from "express";

// D02: passkeys. The relying party is the site's domain (WEBAUTHN_RP_ID) and the browser origins
// allowed to use it (WEBAUTHN_ORIGIN, comma-separated). WebAuthn needs HTTPS, except on localhost.

export const RP_NAME = "Nova Terra";

export const rpId = () => process.env.WEBAUTHN_RP_ID || "localhost";

export const expectedOrigins = (req?: Request) => {
  const configured = (process.env.WEBAUTHN_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  // in development, accept the origin the request comes from when it is on the relying party's host
  const origin = req?.get("origin");
  if (origin && rpId() === "localhost" && new URL(origin).hostname === "localhost" && !configured.includes(origin)) configured.push(origin);
  return configured;
};
