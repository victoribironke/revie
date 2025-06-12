import "dotenv/config";

export const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://revie-backend-858826958747.europe-west9.run.app/"
    : "https://dogfish-viable-instantly.ngrok-free.app";

export const WEBHOOK_URL = BASE_URL + "/telegram-webhook";

export const CREDENTIALS = {
  supabase_url: process.env.SUPABASE_URL,
  supabase_anon_key: process.env.SUPABASE_ANON_KEY,
  supabase_service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY,

  telegram_prod_bot_token: process.env.TELEGRAM_PROD_BOT_TOKEN,
  telegram_dev_bot_token: process.env.TELEGRAM_DEV_BOT_TOKEN,
};

export const TABLES = {
  users: "users",
};
