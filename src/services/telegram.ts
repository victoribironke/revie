import TelegramBot from "node-telegram-bot-api";
import { CREDENTIALS } from "../lib/constants";

const TELEGRAM_BOT_TOKEN =
  process.env.NODE_ENV === "production"
    ? CREDENTIALS.telegram_prod_bot_token
    : CREDENTIALS.telegram_dev_bot_token;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN must be set in .env");
}

console.log("DEBUG: Value of process.env.NODE_ENV:", process.env.NODE_ENV);
console.log(
  "DEBUG: Token selected (first 5 chars):",
  TELEGRAM_BOT_TOKEN.substring(0, 5)
);

export const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
