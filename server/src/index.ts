import dotenv from "dotenv";
import { handleUpdate } from "./bot/handler.js";
import { CREDENTIALS } from "./lib/constants.js";

dotenv.config();

const PORT = CREDENTIALS.port;
const WEBHOOK_SECRET = CREDENTIALS.telegram_webhook_secret;

Bun.serve({
  port: Number(PORT),
  fetch: async (req: Request) => {
    if (req.method === "POST" && new URL(req.url).pathname === "/webhook") {
      const secret = req.headers.get("x-telegram-bot-api-secret-token");
      if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      try {
        const update = await req.json();
        handleUpdate(update).catch(console.error);
        return new Response("OK", { status: 200 });
      } catch (err) {
        return new Response("Bad Request", { status: 400 });
      }
    }

    return new Response("ReviewBot is running", { status: 200 });
  },
});

console.log(`ReviewBot server listening on port ${PORT}`);
