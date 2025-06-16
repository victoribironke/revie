export type Tool = {
  name: string;
  description: string;
  parameters: { [key: string]: string };
  execute: (params: any, chatID: number, userRecord: any) => Promise<string>;
};

export type Message = {
  role: string;
  parts: { text: string }[];
};

export type User = {
  id: string;
  telegram_user_id: string;
  telegram_username: string;
  first_name: string;
  last_name: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  chat_id: string;
  message: string;
  response: string;
  created_at: string;
  user_id: string;
};
