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
  current_place_id: string;
  current_place_name: string;
  last_fetched_reviews_at: string | null;
};

export type Conversation = {
  id: string;
  chat_id: string;
  message: string;
  response: string;
  created_at: string;
  user_id: string;
};

export type Review = {
  id: string;
  place_id: string;
  source: string;
  created_at: string;
  text: string;
  rating: number;
  author: string;
  review_date: string;
  embedding: number[];
};

export type Place = {
  id: string;
  place_id: string;
  name: string;
  address: string;
  last_fetched_reviews_at: string | null;
  created_at: string;
};

export type ConversationState = {
  id: string;
  user_id: string;
  chat_id: number;
  state:
    | "waiting_for_place_name"
    | "waiting_for_place_selection"
    | "chatting"
    | "fetching_reviews";
  context: any;
  updated_at: string;
};
