import type { Request, Response } from "express";
import { HttpError, serviceUnavailable } from "../lib/errors";

// D19: agents consult the information published by the official Terra Nova API.
// Needs TERRA_NOVA_API_KEY in .env (TERRA_NOVA_API_TOKEN is the name in .env.examle),
// sent as X-Webcup-Api-Key. TERRA_NOVA_API_URL overrides the endpoint.

const DEFAULT_URL = "https://24h.webcup.fr/wp-json/webcup/v1/requests/";

const CACHE_TTL_MS = 60_000;
let cache: { fetchedAt: number; body: unknown } | null = null;

const terraNovaController = {
  feed: async (req: Request, res: Response) => {
    const url = process.env.TERRA_NOVA_API_URL || DEFAULT_URL;
    const apiKey = process.env.TERRA_NOVA_API_KEY || process.env.TERRA_NOVA_API_TOKEN;
    if (!apiKey) throw serviceUnavailable("TERRA_NOVA_API_KEY is not configured");

    const fresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
    if (fresh && req.query.refresh !== "true") {
      res.json({ fetched_at: new Date(cache!.fetchedAt).toISOString(), cached: true, data: cache!.body });
      return;
    }

    const headers = { Accept: "application/json", "X-Webcup-Api-Key": apiKey };

    let response: globalThis.Response;
    try {
      response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new HttpError(502, "UPSTREAM_ERROR", "Terra Nova API is unreachable");
    }
    if (!response.ok) throw new HttpError(502, "UPSTREAM_ERROR", `Terra Nova API answered ${response.status}`);

    cache = { fetchedAt: Date.now(), body: await response.json() };
    res.json({ fetched_at: new Date(cache.fetchedAt).toISOString(), cached: false, data: cache.body });
  },
};

export default terraNovaController;
