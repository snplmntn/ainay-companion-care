// ============================================
// Push Notifications Hook
// React hook for managing push notification subscriptions
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  isPushNotificationSupported,
  getNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isSubscribedToPushNotifications,
  sendTestPushNotification,
} from '../services/pushNotificationService';

export interface PushNotificationState {
  /** Whether push notifications are supported in this browser */
  isSupported: boolean;
  /** Current notification permission status */
  permission: NotificationPermission;
  /** Whether user is subscribed to push notifications */
  isSubscribed: boolean;
  /** Whether a subscription operation is in progress */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

export interface UsePushNotificationsReturn extends PushNotificationState {
  /** Subscribe to push notifications */
  subscribe: () => Promise<boolean>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<boolean>;
  /** Toggle subscription state */
  toggle: () => Promise<boolean>;
  /** Send a test notification */
  sendTest: () => Promise<boolean>;
  /** Refresh the current status */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing push notification subscriptions
 */
export function usePushNotifications(userId: string | null): UsePushNotificationsReturn {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    isLoading: true,
    error: null,
  });

  // Check initial status
  const checkStatus = useCallback(async () => {
    const isSupported = isPushNotificationSupported();
    const permission = getNotificationPermission();
    
    let isSubscribed = false;
    if (isSupported && permission === 'granted') {
      isSubscribed = await isSubscribedToPushNotifications();
    }
    
    setState((prev) => ({
      ...prev,
      isSupported,
      permission,
      isSubscribed,
      isLoading: false,
    }));
  }, []);

  // Initial check
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      setState((prev) => ({ ...prev, error: 'User not logged in' }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await subscribeToPushNotifications(userId);
      
      if (result.success) {
        setState((prev) => ({
          ...prev,
          isSubscribed: true,
          permission: 'granted',
          isLoading: false,
        }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          error: result.error || 'Failed to subscribe',
          isLoading: false,
        }));
        return false;
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
      return false;
    }
  }, [userId]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      setState((prev) => ({ ...prev, error: 'User not logged in' }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await unsubscribeFromPushNotifications(userId);
      
      if (result.success) {
        setState((prev) => ({
          ...prev,
          isSubscribed: false,
          isLoading: false,
        }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          error: result.error || 'Failed to unsubscribe',
          isLoading: false,
        }));
        return false;
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
      return false;
    }
  }, [userId]);

  // Toggle subscription
  const toggle = useCallback(async (): Promise<boolean> => {
    if (state.isSubscribed) {
      return unsubscribe();
    } else {
      return subscribe();
    }
  }, [state.isSubscribed, subscribe, unsubscribe]);

  // Send test notification
  const sendTest = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      setState((prev) => ({ ...prev, error: 'User not logged in' }));
      return false;
    }

    if (!state.isSubscribed) {
      setState((prev) => ({ ...prev, error: 'Not subscribed to notifications' }));
      return false;
    }

    try {
      const result = await sendTestPushNotification(userId);
      
      if (!result.success) {
        setState((prev) => ({
          ...prev,
          error: result.error || 'Failed to send test notification',
        }));
      }
      
      return result.success;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      return false;
    }
  }, [userId, state.isSubscribed]);

  // Refresh status
  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    await checkStatus();
  }, [checkStatus]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    toggle,
    sendTest,
    refresh,
  };
}


