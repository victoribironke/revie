import TelegramBot from "node-telegram-bot-api";
import { CREDENTIALS } from "../lib/constants";

const TELEGRAM_BOT_TOKEN =
  process.env.NODE_ENV === "production"
    ? CREDENTIALS.telegram_prod_bot_token
    : CREDENTIALS.telegram_dev_bot_token;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN must be set in .env");
}

export const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);
