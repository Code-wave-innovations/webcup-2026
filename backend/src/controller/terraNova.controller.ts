import type { Request, Response } from "express";
import { HttpError, serviceUnavailable } from "../lib/errors";

// D19: agents consult the information published by the official Terra Nova API.
// Configure TERRA_NOVA_API_URL (and TERRA_NOVA_API_TOKEN if the API needs one) in .env.

const CACHE_TTL_MS = 60_000;
let cache: { fetchedAt: number; body: unknown } | null = null;

const terraNovaController = {
  feed: async (req: Request, res: Response) => {
    const url = process.env.TERRA_NOVA_API_URL;
    if (!url) throw serviceUnavailable("TERRA_NOVA_API_URL is not configured");

    const fresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
    if (fresh && req.query.refresh !== "true") {
      res.json({ fetched_at: new Date(cache!.fetchedAt).toISOString(), cached: true, data: cache!.body });
      return;
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.TERRA_NOVA_API_TOKEN) headers.Authorization = `Bearer ${process.env.TERRA_NOVA_API_TOKEN}`;

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
