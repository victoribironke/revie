import { serve } from "bun";
import { bot } from "./services/telegram";
import { TABLES } from "./lib/constants";
import type { Update } from "node-telegram-bot-api";
import { supabase } from "./services/supabase";
import { healthCheck } from "./routes/health-check";
import { telegramWebhook } from "./routes/telegram/webhook";

const PORT = Number(process.env.PORT) || 8080;

serve({
  port: PORT,
  fetch: async (request) => {
    const url = new URL(request.url);

    console.log("Received request:", request);

    if (request.method === "GET" && url.pathname === "/") {
      return healthCheck();
    }

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return telegramWebhook(request);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Revie backend server listening on port ${PORT}`);
