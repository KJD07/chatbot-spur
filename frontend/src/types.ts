export interface Message {
  id: string;
  sender: "USER" | "AI";
  text: string;
  createdAt: string;
}
