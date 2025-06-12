import type { Update } from "node-telegram-bot-api";

const handler = async (req: Request) => {
  if (req.method === "POST") {
    const update = (await req.json()) as Update;
    console.log("Received Telegram update:", update);

    return new Response(JSON.stringify({ message: "OK", update }), {
      status: 200,
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export default handler;
