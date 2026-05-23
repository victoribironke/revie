import { serve } from "bun";
import { healthCheck } from "./routes/health-check";
import { telegramWebhook } from "./routes/telegram/webhook";

const PORT = Number(process.env.PORT) || 8080;

serve({
  port: PORT,
  fetch: async (request) => {
    const url = new URL(request.url);

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
