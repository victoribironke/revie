import type { InlineButton } from "../types.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const API_URL = "https://api.telegram.org/bot" + BOT_TOKEN;

/**
 * Escapes special HTML characters in text to prevent parsing errors.
 */
export const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

/**
 * Sends a plain text message (with HTML parse mode).
 */
export const sendMessage = async (
  chatId: number,
  text: string,
  parseMode: string = "HTML",
) => {
  try {
    const response = await fetch(API_URL + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode,
      }),
    });

    if (!response.ok) {
      console.error("Telegram sendMessage error:", await response.text());
      return null;
    }

    const data = (await response.json()) as any;
    return data.result;
  } catch (error) {
    console.error("Telegram sendMessage fetch error:", error);
    return null;
  }
};

/**
 * Sends a message with inline keyboard buttons.
 * Returns the sent Message object (needed for message_id to edit later).
 */
export const sendMessageWithKeyboard = async (
  chatId: number,
  text: string,
  keyboard: InlineButton[][],
) => {
  try {
    const inlineKeyboard = keyboard.map((row) =>
      row.map((btn) => {
        const button: any = { text: btn.text };
        if (btn.callback_data) button.callback_data = btn.callback_data;
        if (btn.url) button.url = btn.url;
        return button;
      }),
    );

    const response = await fetch(API_URL + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineKeyboard },
      }),
    });

    if (!response.ok) {
      console.error(
        "Telegram sendMessageWithKeyboard error:",
        await response.text(),
      );
      return null;
    }

    const data = (await response.json()) as any;
    return data.result;
  } catch (error) {
    console.error("Telegram sendMessageWithKeyboard fetch error:", error);
    return null;
  }
};

/**
 * Edits an existing message's text (and optionally its keyboard).
 */
export const editMessage = async (
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: InlineButton[][],
) => {
  try {
    const body: any = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "HTML",
    };

    if (keyboard) {
      body.reply_markup = {
        inline_keyboard: keyboard.map((row) =>
          row.map((btn) => {
            const button: any = { text: btn.text };
            if (btn.callback_data) button.callback_data = btn.callback_data;
            if (btn.url) button.url = btn.url;
            return button;
          }),
        ),
      };
    } else {
      // Remove keyboard if not provided
      body.reply_markup = { inline_keyboard: [] };
    }

    const response = await fetch(API_URL + "/editMessageText", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error("Telegram editMessage error:", await response.text());
    }
  } catch (error) {
    console.error("Telegram editMessage fetch error:", error);
  }
};

/**
 * Acknowledges a callback query to stop the loading animation on the button.
 */
export const answerCallbackQuery = async (
  callbackQueryId: string,
  text?: string,
) => {
  try {
    await fetch(API_URL + "/answerCallbackQuery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
      }),
    });
  } catch (error) {
    console.error("Telegram answerCallbackQuery fetch error:", error);
  }
};

/**
 * Sends "typing..." indicator.
 */
export const sendTyping = async (chatId: number) => {
  try {
    await fetch(API_URL + "/sendChatAction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        action: "typing",
      }),
    });
  } catch (error) {
    console.error("Telegram sendTyping fetch error:", error);
  }
};

/**
 * Sends a generic error message to the user.
 */
export const sendError = async (chatId: number) => {
  await sendMessage(chatId, "Sorry, I ran into an issue. Please try again.");
};
