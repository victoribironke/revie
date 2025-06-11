import "dotenv/config";
import { serve } from "bun";
import { bot } from "./services/telegram";
import { TABLES, WEBHOOK_URL } from "./lib/constants";
import type { Update } from "node-telegram-bot-api";
import { supabase } from "./services/supabase";

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
          try {
            const update = (await request.json()) as Update;
            console.log("Received Telegram update:", update);

            if (update.message) {
              const chatId = update.message.chat.id;
              const text = update.message.text;
              const from = update.message.from;

              // Supabase User Check/Creation
              try {
                let { data: user, error } = await supabase
                  .from(TABLES.users)
                  .select("id")
                  .eq("telegram_user_id", chatId)
                  .single();

                if (error && error.code === "PGRST116") {
                  console.log(`New user: ${chatId}. Creating record.`);

                  const { data: newUser, error: createError } = await supabase
                    .from(TABLES.users)
                    .insert({
                      telegram_user_id: chatId,
                      telegram_username: from?.username,
                      first_name: from?.first_name || "",
                      last_name: from?.last_name || "",
                    });

                  if (createError) throw createError;

                  console.log("New user created:", newUser);
                } else if (error) {
                  throw error;
                }
              } catch (dbError) {
                console.error(
                  "Database error during user check/creation:",
                  dbError
                );

                await bot.sendMessage(
                  chatId,
                  "Oops! Something went wrong on my end (database error). Please try again later."
                );

                return new Response("OK", { status: 200 });
              }

              if (text === "/start") {
                await bot.sendMessage(
                  chatId,
                  "Welcome to Revie! I can help you chat with reviews of places and apps. Type `/chat` to begin."
                );
              } else if (text === "/chat") {
                await bot.sendMessage(
                  chatId,
                  "Okay! Which place, app, or product would you like to chat about its reviews?"
                );
              } else {
                await bot.sendMessage(
                  chatId,
                  "I received your message: " + text
                );
              }
            }

            return new Response("OK", { status: 200 });
          } catch (error) {
            console.error("Error processing Telegram webhook:", error);
            return new Response("Internal Server Error", { status: 500 });
          }
        }

        return new Response("Not Found", { status: 404 });
      },
    });

    console.log(`Revie backend server listening on port ${PORT}`);
  })
  .catch((error) => {
    console.error("Failed to set Telegram webhook:", error);
  });
