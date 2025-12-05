// ============================================
// Telegram Bot Service - Missed Medication Notifications
// ============================================
// Sends instant notifications to companions via Telegram
// when patients miss their medications.
//
// Setup Instructions:
// 1. Create a bot via @BotFather on Telegram
// 2. Get your bot token
// 3. Add TELEGRAM_BOT_TOKEN to your .env file
// ============================================

import TelegramBot from 'node-telegram-bot-api';
import { supabase, isSupabaseConfigured } from './supabase.js';

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'AInayBot';

// Bot instance (lazy initialized)
let bot = null;
let isPolling = false;

// Track acknowledged notifications (in-memory, cleared on restart)
// Key: `${chatId}_${messageId}`, Value: timestamp when acknowledged
const acknowledgedNotifications = new Map();

/**
 * Check if Telegram bot is configured
 */
export function isTelegramConfigured() {
  return !!TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN.length > 20;
}

/**
 * Get or create the bot instance
 */
function getBot() {
  if (!bot && isTelegramConfigured()) {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
  }
  return bot;
}

/**
 * Start the bot with polling (for receiving messages)
 * Call this once when the server starts
 */
export async function startTelegramBot() {
  if (!isTelegramConfigured()) {
    console.log('[Telegram] Bot not configured - skipping start');
    return false;
  }

  if (isPolling) {
    console.log('[Telegram] Bot already polling');
    return true;
  }

  try {
    // Create bot with polling enabled
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    isPolling = true;

    // Get bot info
    const botInfo = await bot.getMe();
    console.log(`[Telegram] Bot started: @${botInfo.username}`);

    // Handle /start command - user initiates linking
    bot.onText(/\/start(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const linkCode = match[1]?.trim(); // e.g., /start ABC123

      console.log(`[Telegram] /start from ${chatId}, linkCode: "${linkCode}"`);

      if (linkCode) {
        // User clicked a deep link with their link code
        await handleLinkRequest(chatId, linkCode, msg.from);
      } else {
        // User just started the bot without a link code
        await bot.sendMessage(
          chatId,
          `👋 *Welcome to AInay!*\n\n` +
          `I'm your AI companion for medication reminders. I'll notify you instantly when your loved ones miss their medications.\n\n` +
          `*To link your account:*\n` +
          `1. Open AInay app\n` +
          `2. Go to Profile → Notification Settings\n` +
          `3. Click "Link Telegram"\n` +
          `4. You'll get a code - send it here!\n\n` +
          `Or just paste your 6-character link code here.`,
          { parse_mode: 'Markdown' }
        );
      }
    });

    // Handle text messages (for manual link code entry)
    bot.on('message', async (msg) => {
      // Skip if it's a command
      if (msg.text?.startsWith('/')) return;

      const chatId = msg.chat.id;
      const text = msg.text?.trim().toUpperCase();

      // Check if it looks like a link code (6 alphanumeric chars)
      if (text && /^[A-Z0-9]{6}$/.test(text)) {
        await handleLinkRequest(chatId, text, msg.from);
      }
    });

    // Handle /status command
    bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;
      const status = await getTelegramLinkStatus(chatId);

      if (status.linked) {
        await bot.sendMessage(
          chatId,
          `✅ *Your Telegram is linked!*\n\n` +
          `Account: ${status.userName}\n` +
          `Email: ${status.email}\n` +
          `Linked patients: ${status.patientCount}\n\n` +
          `You'll receive notifications when your patients miss medications.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await bot.sendMessage(
          chatId,
          `❌ *Not linked yet*\n\n` +
          `Send your 6-character link code from the AInay app to connect.`,
          { parse_mode: 'Markdown' }
        );
      }
    });

    // Handle /help command
    bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      await bot.sendMessage(
        chatId,
        `📖 *AInay Bot Commands*\n\n` +
        `/start - Start the bot & link account\n` +
        `/status - Check your link status\n` +
        `/unlink - Disconnect your Telegram\n` +
        `/help - Show this help message\n\n` +
        `*How it works:*\n` +
        `When your loved one misses a medication, you'll get an instant notification here! 🔔`,
        { parse_mode: 'Markdown' }
      );
    });

    // Handle /unlink command
    bot.onText(/\/unlink/, async (msg) => {
      const chatId = msg.chat.id;
      const result = await unlinkTelegram(chatId);

      if (result.success) {
        await bot.sendMessage(
          chatId,
          `✅ Your Telegram has been unlinked from AInay.\n\n` +
          `You won't receive medication notifications anymore.\n` +
          `Send /start to link again.`
        );
      } else {
        await bot.sendMessage(
          chatId,
          `ℹ️ Your Telegram wasn't linked to any account.\n` +
          `Send /start to link your account.`
        );
      }
    });

    // Handle callback queries (inline keyboard button clicks)
    bot.on('callback_query', async (callbackQuery) => {
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const data = callbackQuery.data;
      const notificationKey = `${chatId}_${messageId}`;

      console.log(`[Telegram] Callback query from ${chatId}: ${data}`);

      // Handle acknowledge button (for companions)
      if (data.startsWith('ack_')) {
        try {
          // Check if already acknowledged
          if (acknowledgedNotifications.has(notificationKey)) {
            const ackTime = acknowledgedNotifications.get(notificationKey);
            await bot.answerCallbackQuery(callbackQuery.id, {
              text: `ℹ️ Already acknowledged at ${ackTime}`,
              show_alert: false,
            });
            return;
          }

          // Mark as acknowledged
          const acknowledgedTime = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          });
          acknowledgedNotifications.set(notificationKey, acknowledgedTime);

          // Answer the callback query (removes loading state from button)
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: '✅ Acknowledged! Thank you for checking on your loved one.',
            show_alert: false,
          });

          // Update the message to show it was acknowledged and REMOVE the button
          const originalText = callbackQuery.message.text;
          await bot.editMessageText(
            `${originalText}\n\n✅ *Acknowledged at ${acknowledgedTime}*`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [] }, // Remove the button
            }
          );

          console.log(`[Telegram] Notification ${notificationKey} acknowledged at ${acknowledgedTime}`);
        } catch (error) {
          console.error('[Telegram] Callback query error:', error.message);
          // Try to answer even if edit fails
          try {
            await bot.answerCallbackQuery(callbackQuery.id, {
              text: '✅ Acknowledged!',
              show_alert: false,
            });
          } catch (e) {
            // Ignore
          }
        }
      }

      // Handle "Taken" button (for patients)
      if (data.startsWith('taken_')) {
        try {
          // Check if already marked as taken
          if (acknowledgedNotifications.has(notificationKey)) {
            const takenTime = acknowledgedNotifications.get(notificationKey);
            await bot.answerCallbackQuery(callbackQuery.id, {
              text: `ℹ️ Already marked as taken at ${takenTime}`,
              show_alert: false,
            });
            return;
          }

          // Mark as taken
          const takenTime = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          });
          acknowledgedNotifications.set(notificationKey, takenTime);

          // Answer the callback query
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: '✅ Great job! Keep up with your medication schedule!',
            show_alert: false,
          });

          // Update the message to show it was taken and REMOVE the button
          const originalText = callbackQuery.message.text;
          await bot.editMessageText(
            `${originalText}\n\n✅ *Taken at ${takenTime}* 🎉`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [] }, // Remove the button
            }
          );

          console.log(`[Telegram] Patient medication marked as taken ${notificationKey} at ${takenTime}`);
        } catch (error) {
          console.error('[Telegram] Taken callback error:', error.message);
          try {
            await bot.answerCallbackQuery(callbackQuery.id, {
              text: '✅ Marked as taken!',
              show_alert: false,
            });
          } catch (e) {
            // Ignore
          }
        }
      }
    });

    return true;
  } catch (error) {
    console.error('[Telegram] Failed to start bot:', error.message);
    isPolling = false;
    return false;
  }
}

/**
 * Stop the bot polling
 */
export function stopTelegramBot() {
  if (bot && isPolling) {
    bot.stopPolling();
    isPolling = false;
    console.log('[Telegram] Bot stopped');
  }
}

/**
 * Handle a link request from Telegram
 */
async function handleLinkRequest(chatId, linkCode, telegramUser) {
  if (!isSupabaseConfigured()) {
    await bot.sendMessage(chatId, '❌ Service temporarily unavailable. Please try again later.');
    return;
  }

  try {
    // Find the user with this link code (companions use patient link codes to connect)
    // But for Telegram, we want companions to link THEIR OWN account
    // So we need a different approach - generate a temporary Telegram link code
    
    // First, check if there's a pending Telegram link with this code
    const { data: pendingLink, error: linkError } = await supabase
      .from('telegram_link_codes')
      .select('user_id, expires_at')
      .eq('code', linkCode)
      .single();

    if (linkError || !pendingLink) {
      await bot.sendMessage(
        chatId,
        `❌ Invalid or expired code.\n\n` +
        `Please get a fresh code from the AInay app:\n` +
        `Profile → Notification Settings → Link Telegram`
      );
      return;
    }

    // Check if expired
    if (new Date(pendingLink.expires_at) < new Date()) {
      await bot.sendMessage(
        chatId,
        `⏰ This code has expired.\n\n` +
        `Please get a fresh code from the AInay app.`
      );
      return;
    }

    // Link the Telegram account
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        telegram_chat_id: chatId.toString(),
        telegram_username: telegramUser?.username || null,
        telegram_linked_at: new Date().toISOString(),
      })
      .eq('id', pendingLink.user_id);

    if (updateError) {
      console.error('[Telegram] Link error:', updateError);
      await bot.sendMessage(chatId, '❌ Failed to link account. Please try again.');
      return;
    }

    // Delete the used link code
    await supabase
      .from('telegram_link_codes')
      .delete()
      .eq('code', linkCode);

    // Get user info for confirmation
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', pendingLink.user_id)
      .single();

    await bot.sendMessage(
      chatId,
      `🎉 *Successfully linked!*\n\n` +
      `Welcome, ${profile?.name || 'Companion'}!\n\n` +
      `You'll now receive instant notifications when your patients miss their medications.\n\n` +
      `💊 Stay caring, stay connected!`,
      { parse_mode: 'Markdown' }
    );

    console.log(`[Telegram] Linked user ${pendingLink.user_id} to chat ${chatId}`);
  } catch (error) {
    console.error('[Telegram] Link request error:', error);
    await bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
  }
}

/**
 * Get Telegram link status for a chat
 */
async function getTelegramLinkStatus(chatId) {
  if (!isSupabaseConfigured()) {
    return { linked: false };
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        patient_companions!patient_companions_companion_id_fkey(count)
      `)
      .eq('telegram_chat_id', chatId.toString())
      .single();

    if (error || !profile) {
      return { linked: false };
    }

    return {
      linked: true,
      userId: profile.id,
      userName: profile.name,
      email: profile.email,
      patientCount: profile.patient_companions?.[0]?.count || 0,
    };
  } catch (error) {
    return { linked: false };
  }
}

/**
 * Unlink Telegram from user account
 */
async function unlinkTelegram(chatId) {
  if (!isSupabaseConfigured()) {
    return { success: false };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        telegram_chat_id: null,
        telegram_username: null,
        telegram_linked_at: null,
      })
      .eq('telegram_chat_id', chatId.toString())
      .select('id')
      .single();

    return { success: !error && !!data };
  } catch (error) {
    return { success: false };
  }
}

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================

/**
 * Send missed medication notification via Telegram
 * @param {Object} params
 * @param {string} params.companionId - The companion's user ID
 * @param {string} params.patientName - The patient's name
 * @param {string} params.medicationName - Name of the missed medication
 * @param {string} params.dosage - Medication dosage
 * @param {string} params.scheduledTime - When it was scheduled
 * @param {number} params.minutesMissed - Minutes since scheduled time
 */
export async function sendMissedMedicationTelegram({
  companionId,
  patientName,
  medicationName,
  dosage,
  scheduledTime,
  minutesMissed,
}) {
  if (!isTelegramConfigured()) {
    return { success: false, error: 'Telegram not configured' };
  }

  const botInstance = getBot();
  if (!botInstance) {
    return { success: false, error: 'Bot not initialized' };
  }

  try {
    // Get companion's Telegram chat ID
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('telegram_chat_id, name')
      .eq('id', companionId)
      .single();

    if (error || !profile?.telegram_chat_id) {
      return { success: false, error: 'Companion not linked to Telegram' };
    }

    const chatId = profile.telegram_chat_id;
    const minutesText = minutesMissed < 1 
      ? 'just now' 
      : minutesMissed < 60 
        ? `${Math.round(minutesMissed)} min ago`
        : `${Math.round(minutesMissed / 60)} hour(s) ago`;

    // Send the notification with emoji for visual appeal
    const message = 
      `🚨 *Missed Medication Alert*\n\n` +
      `👤 Patient: *${patientName}*\n` +
      `💊 Medicine: *${medicationName}*\n` +
      `📏 Dosage: ${dosage}\n` +
      `⏰ Scheduled: ${scheduledTime}\n` +
      `⏳ Missed: ${minutesText}\n\n` +
      `Please check on ${patientName} and remind them to take their medication.`;

    await botInstance.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Acknowledged', callback_data: `ack_${Date.now()}` }
        ]]
      }
    });

    console.log(`[Telegram] Sent notification to ${profile.name} (${chatId})`);
    return { success: true, chatId };
  } catch (error) {
    console.error('[Telegram] Send notification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send a test notification to verify Telegram is working
 */
export async function sendTestTelegramNotification(userId) {
  if (!isTelegramConfigured()) {
    return { success: false, error: 'Telegram not configured' };
  }

  const botInstance = getBot();
  if (!botInstance) {
    return { success: false, error: 'Bot not initialized' };
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('telegram_chat_id, name')
      .eq('id', userId)
      .single();

    if (error || !profile?.telegram_chat_id) {
      return { success: false, error: 'Telegram not linked' };
    }

    await botInstance.sendMessage(
      profile.telegram_chat_id,
      `✅ *Test Notification*\n\n` +
      `Hi ${profile.name}! This is a test from AInay.\n\n` +
      `Your Telegram notifications are working! 🎉\n\n` +
      `You'll receive alerts here when your patients miss medications.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Acknowledged', callback_data: `ack_test_${Date.now()}` }
          ]]
        }
      }
    );

    return { success: true };
  } catch (error) {
    console.error('[Telegram] Test notification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send medication reminder to patient via Telegram (BEFORE scheduled time)
 * @param {Object} params
 * @param {string} params.patientId - The patient's user ID
 * @param {string} params.medicationName - Name of the medication
 * @param {string} params.dosage - Medication dosage
 * @param {string} params.scheduledTime - When it's scheduled
 * @param {number} params.minutesUntil - Minutes until scheduled time
 */
export async function sendPatientReminderTelegram({
  patientId,
  medicationName,
  dosage,
  scheduledTime,
  minutesUntil,
}) {
  if (!isTelegramConfigured()) {
    return { success: false, error: 'Telegram not configured' };
  }

  const botInstance = getBot();
  if (!botInstance) {
    return { success: false, error: 'Bot not initialized' };
  }

  try {
    // Get patient's Telegram chat ID
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('telegram_chat_id, name')
      .eq('id', patientId)
      .single();

    if (error || !profile?.telegram_chat_id) {
      return { success: false, error: 'Patient not linked to Telegram' };
    }

    const chatId = profile.telegram_chat_id;
    const timeText = minutesUntil <= 1 
      ? 'now' 
      : `in ${minutesUntil} minutes`;

    // Send the reminder with a friendly tone
    const message = 
      `💊 *Medication Reminder*\n\n` +
      `Hi ${profile.name}! Time to take your medication ${timeText}.\n\n` +
      `💊 Medicine: *${medicationName}*\n` +
      `📏 Dosage: ${dosage}\n` +
      `⏰ Scheduled: ${scheduledTime}\n\n` +
      `Please take your medication and stay healthy! 🌟`;

    await botInstance.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Taken', callback_data: `taken_${Date.now()}` }
        ]]
      }
    });

    console.log(`[Telegram] Sent patient reminder to ${profile.name} (${chatId})`);
    return { success: true, chatId };
  } catch (error) {
    console.error('[Telegram] Patient reminder error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate a temporary link code for Telegram linking
 * Returns a 6-character code that expires in 10 minutes
 */
export async function generateTelegramLinkCode(userId) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Generate random 6-character code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete any existing codes for this user
    await supabase
      .from('telegram_link_codes')
      .delete()
      .eq('user_id', userId);

    // Insert new code
    const { error } = await supabase
      .from('telegram_link_codes')
      .insert({
        user_id: userId,
        code,
        expires_at: expiresAt,
      });

    if (error) {
      console.error('[Telegram] Generate code error:', error);
      return { success: false, error: 'Failed to generate code' };
    }

    // Generate deep link
    const deepLink = `https://t.me/${BOT_USERNAME}?start=${code}`;

    return { 
      success: true, 
      code, 
      deepLink,
      expiresAt,
      expiresInMinutes: 10,
    };
  } catch (error) {
    console.error('[Telegram] Generate code error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a user has Telegram linked
 */
export async function checkTelegramLinked(userId) {
  if (!isSupabaseConfigured()) {
    return { linked: false };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('telegram_chat_id, telegram_username, telegram_linked_at')
      .eq('id', userId)
      .single();

    if (error || !data?.telegram_chat_id) {
      return { linked: false };
    }

    return {
      linked: true,
      username: data.telegram_username,
      linkedAt: data.telegram_linked_at,
    };
  } catch (error) {
    return { linked: false };
  }
}

/**
 * Unlink Telegram for a specific user
 */
export async function unlinkTelegramForUser(userId) {
  if (!isSupabaseConfigured()) {
    return { success: false };
  }

  try {
    // Get chat ID before unlinking to send goodbye message
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', userId)
      .single();

    if (profile?.telegram_chat_id && isTelegramConfigured()) {
      const botInstance = getBot();
      if (botInstance) {
        try {
          await botInstance.sendMessage(
            profile.telegram_chat_id,
            `👋 Your Telegram has been unlinked from AInay.\n\n` +
            `You won't receive medication notifications here anymore.\n` +
            `Send /start to link again anytime!`
          );
        } catch (e) {
          // Ignore send errors
        }
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        telegram_chat_id: null,
        telegram_username: null,
        telegram_linked_at: null,
      })
      .eq('id', userId);

    return { success: !error };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get Telegram bot status
 */
export function getTelegramStatus() {
  return {
    configured: isTelegramConfigured(),
    polling: isPolling,
    botUsername: BOT_USERNAME,
  };
}

