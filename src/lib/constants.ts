export const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://revie-backend-91lm.onrender.com"
    : "https://dogfish-viable-instantly.ngrok-free.app";

export const WEBHOOK_URL = BASE_URL + "/telegram-webhook";

export const CREDENTIALS = {
  supabase_url: process.env.SUPABASE_URL,
  supabase_anon_key: process.env.SUPABASE_ANON_KEY,
  supabase_service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY,

  telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN,
};

export const TABLES = {
  users: "users",
};
