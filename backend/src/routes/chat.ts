import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { generateReply, ChatMessage } from "../llm";

const router = Router();

const MAX_MESSAGE_LENGTH = 2000;

// Zod schema for POST /chat/message body
const MessageBodySchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(MAX_MESSAGE_LENGTH + 1),
  sessionId: z.string().optional(),
});

// POST /chat/message
router.post(
  "/message",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = MessageBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0].message });
        return;
      }

      let { message, sessionId } = parsed.data;

      // Truncate oversized messages and flag them in context
      let truncationNote = "";
      if (message.length > MAX_MESSAGE_LENGTH) {
        message = message.slice(0, MAX_MESSAGE_LENGTH);
        truncationNote = " [Note: the user's message was truncated to 2000 characters.]";
        console.warn(`[chat] Message truncated for session ${sessionId ?? "new"}`);
      }

      // Get or create conversation
      let conversation;
      if (sessionId) {
        conversation = await prisma.conversation.findUnique({
          where: { id: sessionId },
        });
        if (!conversation) {
          res.status(404).json({ error: "Session not found" });
          return;
        }
      } else {
        conversation = await prisma.conversation.create({ data: {} });
      }

      // Save user message (original, pre-truncation text is fine to store)
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          sender: "USER",
          text: message,
        },
      });

      // Fetch conversation history to build LLM context
      const allMessages = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "asc" },
      });

      // Convert DB messages to LLM history format (exclude the last user message)
      const history: ChatMessage[] = allMessages
        .slice(0, -1)
        .map((m: { sender: string; text: string }) => ({
          role: (m.sender === "USER" ? "user" : "assistant") as "user" | "assistant",
          content: m.text,
        }));

      // Call LLM (pass truncation note as extra context if needed)
      const reply = await generateReply(history, message, truncationNote);

      // Save AI message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          sender: "AI",
          text: reply,
        },
      });

      res.json({ reply, sessionId: conversation.id });
    } catch (error) {
      next(error);
    }
  }
);

// GET /chat/history/:sessionId
router.get(
  "/history/:sessionId",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;

      const conversation = await prisma.conversation.findUnique({
        where: { id: sessionId },
      });

      if (!conversation) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      const messages = await prisma.message.findMany({
        where: { conversationId: sessionId },
        orderBy: { createdAt: "asc" },
      });

      res.json({ messages });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
