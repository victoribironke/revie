import TelegramBot from "node-telegram-bot-api";
import { CREDENTIALS } from "../lib/constants";

const TELEGRAM_BOT_TOKEN = CREDENTIALS.telegram_bot_token;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN must be set in .env");
}

export const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);
