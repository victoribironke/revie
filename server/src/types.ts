export type State = "IDLE" | "AWAITING_SELECTION" | "RECOMMENDING" | "CHATTING";

export type Review = {
  author: string;
  rating: number;
  date: string;
  text: string;
};

export type Place = {
  data_id?: string;
  place_id?: string;
  name: string;
  address: string;
  rating: number;
  reviews_count: number;
  category?: string;
  price?: string;
  snippet?: string;
  highlight?: string;
};

export type Message = {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
};

export type Session = {
  chat_id: number;
  state: State;
  current_place: Place | null;
  knowledge_profile: string | null;
  messages: Message[];
  pending_places: Place[] | null;
  recommendation_query?: string | null;
  updated_at?: string;
};

export type InlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
};
