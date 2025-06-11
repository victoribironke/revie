import "dotenv/config";
import { serve } from "bun";
import { bot } from "./services/telegram";
import { WEBHOOK_URL } from "./lib/constants";

const PORT = process.env.PORT || 3000;

console.log("Setting Telegram webhook to:", WEBHOOK_URL);

bot
  .setWebHook(WEBHOOK_URL)
  .then(() => {
    serve({
      port: PORT,
      fetch: async (request) => {
        const url = new URL(request.url);
        if (request.method === "POST" && url.pathname === "/telegram-webhook") {
          // This is where Telegram will send updates

          console.log("Received Telegram webhook request");
          // You'll process the update here later
          return new Response("OK", { status: 200 });
        }

        return new Response("Not Found", { status: 404 });
      },
    });

    console.log(`Revie backend server listening on port ${PORT}`);
  })
  .catch((error) => {
    console.error("Failed to set Telegram webhook:", error);
  });
