const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const API_URL = "https://api.telegram.org/bot" + BOT_TOKEN;

export const sendMessage = async (chatId: number, text: string) => {
  try {
    const response = await fetch(API_URL + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });

    if (!response.ok) {
      console.error("Telegram sendMessage error:", await response.text());
    }
  } catch (error) {
    console.error("Telegram sendMessage fetch error:", error);
  }
};

export const sendTyping = async (chatId: number) => {
  try {
    const response = await fetch(API_URL + "/sendChatAction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        action: "typing",
      }),
    });

    if (!response.ok) {
      console.error("Telegram sendTyping error:", await response.text());
    }
  } catch (error) {
    console.error("Telegram sendTyping fetch error:", error);
  }
};

export const sendError = async (chatId: number) => {
  await sendMessage(chatId, "Sorry, I ran into an issue. Please try again.");
};
