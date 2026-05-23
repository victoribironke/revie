export type Intent = "new_search" | "followup" | "command";

export type Review = {
  author: string;
  rating: number;
  date: string;
  text: string;
};

export type Place = {
  place_id: string;
  name: string;
  address: string;
  rating: number;
  reviews_count: number;
};

export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type Session = {
  chat_id: number;
  current_place: Place | null;
  current_reviews: Review[] | null;
  messages: Message[];
  pending_places: Place[] | null;
  updated_at?: string;
};
