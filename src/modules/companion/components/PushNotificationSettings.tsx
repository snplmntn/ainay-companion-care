// ============================================
// Push Notification Settings Component
// UI for managing browser push notifications
// ============================================

import React from 'react';
import { Bell, BellOff, BellRing, Smartphone, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';

export function PushNotificationSettings() {
  const { user } = useApp();
  const userId = user?.id ?? null;
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    toggle,
  } = usePushNotifications(userId);

  const handleToggle = async () => {
    const success = await toggle();
    
    if (success) {
      if (!isSubscribed) {
        toast.success('Push notifications enabled!', {
          description: 'You will receive alerts about patient medications.',
        });
      } else {
        toast.info('Push notifications disabled');
      }
    } else if (error) {
      toast.error('Failed to update notifications', {
        description: error,
      });
    }
  };

  // User not logged in
  if (!userId) {
    return (
      <Card className="border-gray-200 bg-gray-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-gray-700">
            <Bell className="w-5 h-5" />
            Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Please log in to enable push notifications.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Not supported
  if (!isSupported) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <AlertCircle className="w-5 h-5" />
            Push Notifications Not Available
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-700">
            Your browser doesn't support push notifications. Try using Chrome, Firefox, Edge, or Safari on a supported device.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Permission denied
  if (permission === 'denied') {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-red-800">
            <BellOff className="w-5 h-5" />
            Notifications Blocked
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-700 mb-3">
            You have blocked notifications for this site. To enable them:
          </p>
          <ol className="text-sm text-red-700 list-decimal list-inside space-y-1">
            <li>Click the lock/info icon in your browser's address bar</li>
            <li>Find "Notifications" and change it to "Allow"</li>
            <li>Refresh this page</li>
          </ol>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isSubscribed ? 'bg-teal-100' : 'bg-gray-100'
            }`}>
              {isSubscribed ? (
                <BellRing className="w-5 h-5 text-teal-600" />
              ) : (
                <Bell className="w-5 h-5 text-gray-500" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">Push Notifications</CardTitle>
              <CardDescription>
                Receive instant alerts on this device
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={isSubscribed}
            onCheckedChange={handleToggle}
            disabled={isLoading}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              <span className="text-gray-500">Updating...</span>
            </>
          ) : isSubscribed ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-green-700">Notifications enabled</span>
            </>
          ) : (
            <>
              <Smartphone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Notifications disabled</span>
            </>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground">
          {isSubscribed
            ? "You'll receive push notifications when patients miss medications or prescriptions are expiring."
            : 'Enable push notifications to get instant alerts about your patients, even when the app is closed.'}
        </p>

        {/* Error display */}
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {/* What you'll receive */}
        {!isSubscribed && permission !== 'denied' && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-gray-700">You'll be notified when:</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                A patient misses their medication
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                A prescription is about to expire
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                A patient accepts your link request
              </li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

