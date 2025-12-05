import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage } from '@/types';

const initialMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content: "Hello! I'm AInay, your health companion. Ask me anything about your medications or health!",
    timestamp: new Date(),
  },
];

// TODO: Connect Mic to Whisper API and Text to GPT-4o
const simulatedResponses: Record<string, string> = {
  'white pill': "That is your Losartan 50mg. It's for blood pressure. Take it after breakfast with water.",
  'losartan': "Losartan is your blood pressure medication. The recommended time is 7:00 AM after breakfast.",
  'side effects': "Common side effects may include dizziness. If you feel unwell, please contact your doctor.",
  'default': "I understand your concern. Let me help you with that. Could you tell me more about what you'd like to know?",
};

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    for (const [key, response] of Object.entries(simulatedResponses)) {
      if (lowerQuery.includes(key)) {
        return response;
      }
    }
    return simulatedResponses['default'];
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const response = getResponse(text);
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  // TODO: Replace with OpenAI Whisper API
  const handleVoiceInput = () => {
    setIsRecording(true);
    
    // Simulate voice recognition
    setTimeout(() => {
      setIsRecording(false);
      const recognizedText = "What is this white pill?";
      setInput(recognizedText);
      
      // Auto-send after recognition
      setTimeout(() => {
        sendMessage(recognizedText);
      }, 500);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 fade-in ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              message.role === 'assistant' 
                ? 'bg-secondary text-secondary-foreground' 
                : 'bg-primary text-primary-foreground'
            }`}>
              {message.role === 'assistant' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>

            {/* Message bubble */}
            <div className={`max-w-[80%] p-4 rounded-2xl ${
              message.role === 'assistant'
                ? 'bg-card border border-border rounded-tl-md'
                : 'gradient-coral text-white rounded-tr-md'
            }`}>
              <p className="text-senior-base">{message.content}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3 fade-in">
            <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-card border border-border p-4 rounded-2xl rounded-tl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="p-4 border-t border-border bg-background">
        <div className="flex gap-3">
          <Button
            variant={isRecording ? 'destructive' : 'secondary'}
            size="icon-lg"
            onClick={handleVoiceInput}
            disabled={isRecording}
            className="rounded-full shrink-0"
          >
            {isRecording ? (
              <MicOff className="w-6 h-6 animate-pulse" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </Button>

          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            className="input-senior flex-1"
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
          />

          <Button
            variant="coral"
            size="icon-lg"
            onClick={() => sendMessage(input)}
            disabled={!input.trim()}
            className="rounded-full shrink-0"
          >
            <Send className="w-6 h-6" />
          </Button>
        </div>

        {isRecording && (
          <p className="text-center text-primary font-semibold mt-3 animate-pulse">
            🎤 Listening...
          </p>
        )}
      </div>
    </div>
  );
}
