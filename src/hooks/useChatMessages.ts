import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types";
import {
  chatCompletion,
  analyzeMedicineImages,
  buildMessagesFromHistory,
  UserContext,
} from "@/services/openai";

const generateId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

interface UseChatMessagesOptions {
  initialMessages?: ChatMessage[];
  userContext?: UserContext;
  onMessageSent?: (message: ChatMessage) => void;
  onResponseReceived?: (response: ChatMessage) => void;
}

interface UseChatMessagesReturn {
  messages: ChatMessage[];
  isTyping: boolean;
  sendMessage: (text: string, imageUrls?: string[]) => Promise<string | null>;
  addMessage: (message: ChatMessage) => void;
  updateInitialMessage: (message: ChatMessage) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

/**
 * Custom hook for managing chat messages and AI interactions
 * OPTIMIZATION: Extracted from ChatInterface for reusability and maintainability
 */
export function useChatMessages(
  options: UseChatMessagesOptions = {}
): UseChatMessagesReturn {
  const { initialMessages = [], userContext, onMessageSent, onResponseReceived } =
    options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Add a message to the chat
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  // Update the initial message (for dynamic greetings)
  const updateInitialMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "1") {
        return [message];
      }
      return prev;
    });
  }, []);

  // Send a message and get AI response
  const sendMessage = useCallback(
    async (text: string, imageUrls: string[] = []): Promise<string | null> => {
      const cleanedText = text.trim();
      const hasContent = cleanedText || imageUrls.length > 0;

      if (!hasContent || isTyping) return null;

      // Build content description
      let messageContent = cleanedText;
      if (!messageContent && imageUrls.length > 0) {
        messageContent =
          imageUrls.length === 1
            ? "Please identify this medicine."
            : `Please identify these ${imageUrls.length} medicines.`;
      }

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: messageContent,
        timestamp: new Date(),
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      };

      setMessages((prev) => [...prev, userMessage]);
      if (onMessageSent) {
        onMessageSent(userMessage);
      }

      setIsTyping(true);

      try {
        let assistantContent: string;

        if (imageUrls.length > 0) {
          // Use vision API for image analysis
          assistantContent = await analyzeMedicineImages(
            imageUrls,
            cleanedText || undefined,
            userContext
          );
        } else {
          // Regular chat completion with history
          const conversation = [...messages, userMessage];
          const openAIMessages = buildMessagesFromHistory(
            conversation.map((m) => ({
              role: m.role,
              content: m.content,
              imageUrls: m.imageUrls,
            }))
          );
          assistantContent = await chatCompletion({
            messages: openAIMessages,
            userContext,
          });
        }

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: assistantContent,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        if (onResponseReceived) {
          onResponseReceived(assistantMessage);
        }

        return assistantContent;
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Sorry, I could not reach AInay right now. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return null;
      } finally {
        setIsTyping(false);
      }
    },
    [messages, isTyping, userContext, onMessageSent, onResponseReceived]
  );

  return {
    messages,
    isTyping,
    sendMessage,
    addMessage,
    updateInitialMessage,
    messagesEndRef,
  };
}

/**
 * Build an initial greeting message based on user context
 */
export function buildInitialMessage(
  userName?: string,
  medications?: Array<{ name: string; taken: boolean; time: string }>
): ChatMessage {
  let greeting = "Hello";
  if (userName) {
    greeting = `Hello, ${userName}`;
  }

  let medicationInfo = "";
  if (medications && medications.length > 0) {
    const pending = medications.filter((m) => !m.taken);
    const taken = medications.filter((m) => m.taken);

    if (pending.length > 0) {
      const pendingList = pending
        .slice(0, 3)
        .map((m) => `**${m.name}** at ${m.time}`)
        .join(", ");
      const moreCount =
        pending.length > 3 ? ` and ${pending.length - 3} more` : "";
      medicationInfo = `\n\n💊 **Pending medications today:** ${pendingList}${moreCount}`;
    }

    if (taken.length > 0 && pending.length === 0) {
      medicationInfo = `\n\n✅ **Great job!** You've taken all ${
        taken.length
      } medication${taken.length > 1 ? "s" : ""} today!`;
    } else if (taken.length > 0) {
      medicationInfo += `\n✅ ${taken.length} medication${
        taken.length > 1 ? "s" : ""
      } already taken.`;
    }
  } else {
    medicationInfo =
      "\n\n📝 **Tip:** Add your medications so I can help you track them and remind you when to take them!";
  }

  return {
    id: "1",
    role: "assistant",
    content: `${greeting}! I'm AInay, your health companion. You can:

- 📷 **Scan medicines** with your camera
- 🖼️ **Upload photos** from your gallery
- 📎 **Attach files** (images or prescription photos)
- 🎤 **Ask by voice** about your medications
- ⌨️ **Type questions** about health

I can identify multiple medicines at once and help you add them to your list!${medicationInfo}`,
    timestamp: new Date(),
  };
}


