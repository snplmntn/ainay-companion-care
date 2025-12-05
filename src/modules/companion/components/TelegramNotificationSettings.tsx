// ============================================
// Telegram Notification Settings Component
// ============================================
// Allows companions to link/unlink their Telegram for notifications

import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Link2,
  Unlink,
  ExternalLink,
  Check,
  Copy,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';
import {
  getTelegramStatus,
  generateTelegramLinkCode,
  checkTelegramLinked,
  unlinkTelegram,
  sendTestTelegramNotification,
} from '../services/telegramService';

export function TelegramNotificationSettings() {
  const { profile } = useApp();
  const userId = profile?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [isBotConfigured, setIsBotConfigured] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [isLinked, setIsLinked] = useState(false);
  const [linkedUsername, setLinkedUsername] = useState<string | null>(null);
  const [linkedAt, setLinkedAt] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Check bot status and user link status
  const checkStatus = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      // Check if Telegram bot is configured on server
      const status = await getTelegramStatus();
      setIsBotConfigured(status.configured);
      setBotUsername(status.telegram?.botUsername || null);

      if (status.configured) {
        // Check if user has Telegram linked
        const linkStatus = await checkTelegramLinked(userId);
        setIsLinked(linkStatus.linked);
        setLinkedUsername(linkStatus.username || null);
        setLinkedAt(linkStatus.linkedAt || null);
      }
    } catch (error) {
      console.error('Failed to check Telegram status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Generate a new link code
  const handleGenerateLinkCode = async () => {
    if (!userId) return;

    setIsGenerating(true);
    try {
      const result = await generateTelegramLinkCode(userId);

      if (result.success && result.code) {
        setLinkCode(result.code);
        setDeepLink(result.deepLink || null);
        setCodeExpiresAt(result.expiresAt ? new Date(result.expiresAt) : null);

        toast({
          title: 'Link code generated!',
          description: `Code: ${result.code} (expires in ${result.expiresInMinutes} minutes)`,
        });
      } else {
        toast({
          title: 'Failed to generate code',
          description: result.error || 'Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to generate link code:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate link code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy link code to clipboard
  const handleCopyCode = async () => {
    if (!linkCode) return;

    try {
      await navigator.clipboard.writeText(linkCode);
      toast({
        title: 'Copied!',
        description: 'Link code copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Please copy the code manually.',
        variant: 'destructive',
      });
    }
  };

  // Open Telegram deep link
  const handleOpenTelegram = () => {
    if (deepLink) {
      window.open(deepLink, '_blank');
    }
  };

  // Unlink Telegram
  const handleUnlink = async () => {
    if (!userId) return;

    setIsUnlinking(true);
    try {
      const result = await unlinkTelegram(userId);

      if (result.success) {
        setIsLinked(false);
        setLinkedUsername(null);
        setLinkedAt(null);
        setLinkCode(null);
        setDeepLink(null);

        toast({
          title: 'Telegram unlinked',
          description: "You won't receive Telegram notifications anymore.",
        });
      } else {
        toast({
          title: 'Failed to unlink',
          description: result.error || 'Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to unlink Telegram:', error);
      toast({
        title: 'Error',
        description: 'Failed to unlink Telegram. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  // Send test notification
  const handleSendTest = async () => {
    if (!userId) return;

    setIsTesting(true);
    try {
      const result = await sendTestTelegramNotification(userId);

      if (result.success) {
        toast({
          title: 'Test notification sent!',
          description: 'Check your Telegram for the message.',
        });
      } else {
        toast({
          title: 'Test failed',
          description: result.error || 'Please check your Telegram link.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test notification.',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Check if code is expired
  const isCodeExpired = codeExpiresAt && new Date() > codeExpiresAt;

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading Telegram settings...</span>
        </div>
      </Card>
    );
  }

  if (!isBotConfigured) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Send className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">Telegram Notifications</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Telegram notifications are not available yet. Contact support for more info.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          isLinked 
            ? 'bg-[#0088cc]/10' 
            : 'bg-muted'
        }`}>
          <Send className={`w-5 h-5 ${isLinked ? 'text-[#0088cc]' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Telegram Notifications</h3>
            {isLinked && (
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                Linked
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isLinked
              ? 'You will receive instant notifications on Telegram when your patients miss medications.'
              : 'Link your Telegram to receive instant medication alerts.'}
          </p>
        </div>
      </div>

      {isLinked ? (
        // Linked state
        <div className="space-y-4">
          {/* Linked info */}
          <div className="bg-[#0088cc]/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-green-500" />
              <span className="font-medium">Connected to Telegram</span>
            </div>
            {linkedUsername && (
              <p className="text-sm text-muted-foreground">
                Username: <span className="font-medium">@{linkedUsername}</span>
              </p>
            )}
            {linkedAt && (
              <p className="text-sm text-muted-foreground">
                Linked: {new Date(linkedAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendTest}
              disabled={isTesting}
              className="flex-1"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Test Notification
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlink}
              disabled={isUnlinking}
              className="text-destructive hover:text-destructive"
            >
              {isUnlinking ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Unlink className="w-4 h-4 mr-2" />
              )}
              Unlink
            </Button>
          </div>
        </div>
      ) : (
        // Not linked state
        <div className="space-y-4">
          {linkCode && !isCodeExpired ? (
            // Show link code
            <div className="space-y-3">
              <div className="bg-muted rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">Your link code:</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-mono font-bold tracking-wider text-primary">
                    {linkCode}
                  </span>
                  <Button variant="ghost" size="icon" onClick={handleCopyCode}>
                    <Copy className="w-5 h-5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Expires in {Math.ceil((codeExpiresAt!.getTime() - Date.now()) / 60000)} minutes
                </p>
              </div>

              {/* Instructions */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">How to link:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Open Telegram</li>
                  <li>Click the button below or search for <span className="font-mono font-medium text-[#0088cc]">@{botUsername || 'AInayBot'}</span></li>
                  <li>Send the code above to the bot</li>
                </ol>
              </div>

              <Button
                onClick={handleOpenTelegram}
                className="w-full bg-[#0088cc] hover:bg-[#0088cc]/90"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Telegram Bot
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={checkStatus}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                I've sent the code, check status
              </Button>
            </div>
          ) : (
            // Generate code button
            <div className="space-y-3">
              {isCodeExpired && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Previous code expired. Generate a new one.</span>
                </div>
              )}

              {/* Bot Info */}
              {botUsername && (
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Our Telegram Bot:</p>
                  <p className="font-mono font-semibold text-[#0088cc] text-lg">@{botUsername}</p>
                </div>
              )}

              <Button
                onClick={handleGenerateLinkCode}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="w-4 h-4 mr-2" />
                )}
                {isGenerating ? 'Generating...' : 'Link Telegram'}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                You'll receive a code to send to our Telegram bot
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

