import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = await buildApp(config);

const address = await app.listen({ port: config.PORT, host: "0.0.0.0" });
console.log(`STT API listening on ${address} (health: GET /health)`);
