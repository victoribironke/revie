export const CLASSIFICATION_MODEL = "meta-llama/llama-3.2-3b-instruct:free";
export const CHAT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export const CREDENTIALS = {
  openrouter_api_key: process.env.OPENROUTER_API_KEY || "",

  serpapi_key: process.env.SERPAPI_KEY || "",

  supabase_url: process.env.SUPABASE_URL || "",
  supapbase_service_role_key: process.env.S9UPABASE_SERVICE_ROLE_KEY || "",

  telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN || "",
  telegram_webhook_secret: process.env.TELEGRAM_WEBHOOK_SECRET || "",

  port: process.env.PORT || 8080,
};
