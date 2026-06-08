import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const SYSTEM_PROMPT = `You are a helpful support agent for Spur Store, a fictional e-commerce store. Answer clearly and concisely.
Store info:
- Ships worldwide in 5-7 days.
- Free shipping above $50.
- Returns accepted within 30 days, no questions asked.
- Support hours: Mon-Fri 9am-6pm IST.`;

const MODEL = "google/gemma-4-31b-it:free";
const HISTORY_WINDOW = 10;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function generateReply(
  history: ChatMessage[],
  userMessage: string,
  truncationNote = ""
): Promise<string> {
  try {
    const recentHistory = history.slice(-HISTORY_WINDOW);

    // Append truncation note to system prompt if message was cut
    const systemContent = truncationNote
      ? SYSTEM_PROMPT + truncationNote
      : SYSTEM_PROMPT;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...recentHistory,
      { role: "user", content: userMessage },
    ];

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: 512,
    });

    const reply = completion.choices[0]?.message?.content;
    if (!reply) {
      throw new Error("Empty response from LLM");
    }

    return reply.trim();
  } catch (error) {
    console.error("[llm] Error calling OpenRouter:", error);
    return "Sorry, I'm having trouble right now. Please try again shortly.";
  }
}
