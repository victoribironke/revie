import { handleUpdate } from "./bot/handler.js";

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

Bun.serve({
  port: Number(PORT),
  hostname: "0.0.0.0",
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

    return new Response("Revie is running!", { status: 200 });
  },
});

console.log(`ReviewBot server listening on port ${PORT}`);
