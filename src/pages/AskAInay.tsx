import React from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChatInterface } from '@/components/ChatInterface';
import { Navigation } from '@/components/Navigation';

export default function AskAInay() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </Button>
        
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 gradient-teal rounded-full flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-senior-lg font-bold">Ask AInay</h1>
            <p className="text-sm text-secondary">Your health assistant</p>
          </div>
        </div>
      </header>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col pb-20">
        <ChatInterface />
      </div>

      {/* Navigation */}
      <Navigation />
    </div>
  );
}
