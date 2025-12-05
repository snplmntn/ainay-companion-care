// Load environment variables FIRST (before any other imports that use process.env)
import "dotenv/config";

import express from "express";
import cors from "cors";
import cron from "node-cron";
import PayRex from "payrex-node";
import rateLimit from "express-rate-limit";
import { z } from "zod";

// Import services
import { isSupabaseConfigured } from "./services/supabase.js";
import {
  isEmailConfigured,
  verifyConnection,
  getEmailStatus,
  isUsingBrevo,
} from "./services/email.js";
import {
  checkAndNotifyMissedDoses,
  getNotificationStatus,
  sendTestNotification,
} from "./services/notifications.js";
import {
  isPushNotificationConfigured,
  getVapidPublicKey,
  savePushSubscription,
  removePushSubscription,
  sendTestPushNotification,
  getPushNotificationStatus,
} from "./services/pushNotifications.js";
import {
  getNotificationStats,
  autoExpireAllMedications,
  getAllExpiringMedications,
  getLinkedCompanionsForPatients,
} from "./services/supabase.js";
import { sendEmail, sendMissedMedicationEmail } from "./services/email.js";
import {
  checkAndSendPatientReminders,
  getPatientReminderStatus,
} from "./services/patientReminders.js";

const app = express();
const PORT = process.env.PORT || 3001;

// PayRex SDK Configuration
// Docs: https://docs.payrexhq.com/
const PAYREX_SECRET_KEY = process.env.PAYREX_SECRET_KEY || "";
const payrex = PAYREX_SECRET_KEY ? new PayRex(PAYREX_SECRET_KEY) : null;

// Subscription Plans
const SUBSCRIPTION_PLANS = {
  pro: {
    id: "pro",
    name: "AInay Pro Subscription",
    price: 99,
    priceInCents: 9900, // 99 pesos in centavos
    description: "Monthly subscription - Unlock all features",
  },
};

// ============================================
// OPTIMIZATION: Request Validation Schemas (Zod)
// ============================================

const checkoutSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
});

const testNotificationSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().optional().default("Test User"),
});

/**
 * Middleware to validate request body with Zod schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

// ============================================
// OPTIMIZATION: Rate Limiting
// ============================================

// General API rate limit: 100 requests per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for payment endpoints: 10 requests per minute
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: "Too many payment requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for notification endpoints: 5 requests per minute
const notificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: "Too many notification requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware - CORS Configuration
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = [
  // Development origins
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:5173",
  // Production origin (set via FRONTEND_URL env var)
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`CORS blocked origin: ${origin}`);
        // In production, block unknown origins. In development, allow all.
        if (isProduction) {
          callback(new Error("Not allowed by CORS"));
        } else {
          callback(null, true);
        }
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    payrexConfigured: isPayRexConfigured(),
    mode: getPayRexMode(),
    openaiConfigured: isOpenAIConfigured(),
  });
});

// ============================================
// OpenAI Proxy Configuration
// ============================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";

function isOpenAIConfigured() {
  return !!OPENAI_API_KEY;
}

// Rate limiter for OpenAI endpoints (more restrictive)
const openaiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: "Too many AI requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/openai/chat - Proxy for OpenAI chat completions (including vision)
 */
app.post("/api/openai/chat", openaiLimiter, async (req, res) => {
  if (!isOpenAIConfigured()) {
    return res.status(503).json({
      error: "OpenAI is not configured on the server",
      details: "Set OPENAI_API_KEY in your server .env file",
    });
  }

  try {
    const { model, messages, temperature, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o",
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens ?? 1500,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data?.error?.message);
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI request failed",
      });
    }

    res.json(data);
  } catch (error) {
    console.error("OpenAI proxy error:", error);
    res.status(500).json({ error: "Failed to process AI request" });
  }
});

/**
 * POST /api/openai/transcribe - Proxy for OpenAI Whisper transcription
 */
app.post("/api/openai/transcribe", openaiLimiter, async (req, res) => {
  if (!isOpenAIConfigured()) {
    return res.status(503).json({
      error: "OpenAI is not configured on the server",
      details: "Set OPENAI_API_KEY in your server .env file",
    });
  }

  try {
    // For transcription, we expect base64 audio data
    const { audio, filename, model, language } = req.body;

    if (!audio) {
      return res.status(400).json({ error: "audio (base64) is required" });
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, "base64");

    // Create form data for Whisper API
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: "audio/webm" });
    formData.append("file", blob, filename || "recording.webm");
    formData.append("model", model || "whisper-1");
    if (language) {
      formData.append("language", language);
    }

    const response = await fetch(OPENAI_WHISPER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Whisper API error:", data?.error?.message);
      return res.status(response.status).json({
        error: data?.error?.message || "Transcription failed",
      });
    }

    res.json(data);
  } catch (error) {
    console.error("Whisper proxy error:", error);
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

/**
 * POST /api/openai/tts - Proxy for OpenAI Text-to-Speech
 */
app.post("/api/openai/tts", openaiLimiter, async (req, res) => {
  if (!isOpenAIConfigured()) {
    return res.status(503).json({
      error: "OpenAI is not configured on the server",
      details: "Set OPENAI_API_KEY in your server .env file",
    });
  }

  try {
    const { input, voice, speed, model, response_format } = req.body;

    if (!input) {
      return res.status(400).json({ error: "input text is required" });
    }

    const response = await fetch(OPENAI_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || "tts-1",
        input,
        voice: voice || "nova",
        speed: speed ?? 1.0,
        response_format: response_format || "mp3",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("TTS API error:", errorData?.error?.message);
      return res.status(response.status).json({
        error: errorData?.error?.message || "TTS failed",
      });
    }

    // Stream the audio response directly
    const audioBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error("TTS proxy error:", error);
    res.status(500).json({ error: "Failed to generate audio" });
  }
});

// ============================================
// PayRex Payment Endpoints
// ============================================

/**
 * Create a checkout session for Pro subscription using PayRex SDK
 * POST /api/payments/checkout
 * Body: { userId, successUrl, cancelUrl, email?, name? }
 */
app.post(
  "/api/payments/checkout",
  paymentLimiter,
  validateBody(checkoutSchema),
  async (req, res) => {
    try {
      const { userId, successUrl, cancelUrl, email, name } = req.body;

      if (!isPayRexConfigured() || !payrex) {
        return res.status(503).json({
          error: "Payment system not configured",
          details:
            "PayRex API key not set. Add PAYREX_SECRET_KEY to server environment.",
        });
      }

      const proPlan = SUBSCRIPTION_PLANS.pro;
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:8080";

      // Generate a unique reference ID that we can include in the success URL
      // This ensures we can find the session even if localStorage is cleared
      const txnRef = `txn_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}`;

      console.log("[PayRex SDK] Creating checkout for user:", userId);
      console.log("[PayRex SDK] Transaction reference:", txnRef);

      try {
        // Build success URL with transaction reference
        const baseSuccessUrl = successUrl || `${baseUrl}/subscription/success`;
        const successUrlWithRef = `${baseSuccessUrl}${
          baseSuccessUrl.includes("?") ? "&" : "?"
        }txn_ref=${txnRef}`;

        // Create a checkout session using PayRex SDK
        // Docs: https://docs.payrexhq.com/docs/guide/developer_handbook/payments/integrations/checkout
        const checkoutSession = await payrex.checkoutSessions.create({
          currency: "PHP",
          success_url: successUrlWithRef,
          cancel_url: cancelUrl || `${baseUrl}/subscription/pricing`,
          payment_methods: ["card", "gcash", "maya", "qrph"],
          line_items: [
            {
              name: proPlan.name,
              amount: proPlan.priceInCents, // Amount in cents (9900 = ₱99.00)
              quantity: 1,
            },
          ],
          metadata: {
            user_id: userId,
            tier: "pro",
            subscription_type: "monthly",
            txn_ref: txnRef,
          },
        });

        console.log(
          "[PayRex SDK] Checkout session created:",
          checkoutSession.id
        );
        console.log("[PayRex SDK] Checkout URL:", checkoutSession.url);

        // Store the mapping of txn_ref -> session_id for later lookup
        checkoutReferences.set(txnRef, {
          sessionId: checkoutSession.id,
          userId,
          createdAt: new Date().toISOString(),
        });

        res.json({
          success: true,
          checkoutUrl: checkoutSession.url,
          sessionId: checkoutSession.id,
          txnRef,
        });
      } catch (sdkError) {
        console.error("[PayRex SDK] Error:", sdkError.message);
        console.log("[PayRex SDK] Falling back to DEMO mode");

        // Fall back to demo mode
        const demoPayload = {
          success_url:
            successUrl ||
            `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
          metadata: { user_id: userId, tier: "pro" },
        };
        return createDemoCheckoutSession(res, userId, demoPayload);
      }
    } catch (error) {
      console.error("[PayRex] Checkout error:", error);
      res.status(500).json({
        error: "Failed to create checkout session",
        details: error.message,
      });
    }
  }
);

/**
 * Look up session ID by transaction reference
 * GET /api/payments/lookup/:txnRef
 */
app.get("/api/payments/lookup/:txnRef", paymentLimiter, (req, res) => {
  const { txnRef } = req.params;

  console.log("[PayRex] Looking up txn_ref:", txnRef);

  const data = checkoutReferences.get(txnRef);
  if (data) {
    console.log("[PayRex] Found session for txn_ref:", data.sessionId);
    return res.json({
      success: true,
      sessionId: data.sessionId,
      userId: data.userId,
    });
  }

  console.log("[PayRex] No session found for txn_ref:", txnRef);
  return res.status(404).json({
    success: false,
    error: "Transaction reference not found",
  });
});

/**
 * Verify a checkout session
 * GET /api/payments/verify/:sessionId
 */
app.get("/api/payments/verify/:sessionId", paymentLimiter, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check if this is a demo session first
    if (sessionId.startsWith("demo_")) {
      const demoSession = demoSessions.get(sessionId);
      if (demoSession) {
        console.log("[PayRex DEMO] Verifying demo session:", sessionId);
        return res.json({
          success: true,
          status: demoSession.status,
          tier: demoSession.tier,
          userId: demoSession.userId,
          demo: true,
        });
      }
      // If demo session not found, still return success for hackathon demo
      console.log("[PayRex DEMO] Demo session not found, auto-completing");
      return res.json({
        success: true,
        status: "completed",
        tier: "pro",
        demo: true,
      });
    }

    if (!isPayRexConfigured() || !payrex) {
      return res.status(503).json({
        error: "Payment system not configured",
      });
    }

    console.log("[PayRex SDK] Verifying session:", sessionId);

    try {
      const session = await payrex.checkoutSessions.retrieve(sessionId);
      const isCompleted =
        session.status === "complete" || session.status === "completed";

      console.log("[PayRex SDK] Session status:", session.status);

      res.json({
        success: isCompleted,
        status: session.status,
        tier: session.metadata?.tier || "pro",
        userId: session.metadata?.user_id,
      });
    } catch (sdkError) {
      console.error("[PayRex SDK] Verify Error:", sdkError.message);
      return res.status(500).json({
        error: "Failed to verify checkout session",
        details: sdkError.message,
      });
    }
  } catch (error) {
    console.error("[PayRex] Verify error:", error);
    res.status(500).json({
      error: "Failed to verify payment",
      details: error.message,
    });
  }
});

/**
 * Expire a checkout session
 * POST /api/payments/expire/:sessionId
 */
app.post(
  "/api/payments/expire/:sessionId",
  paymentLimiter,
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!isPayRexConfigured() || !payrex) {
        return res.status(503).json({
          error: "Payment system not configured",
        });
      }

      try {
        await payrex.checkoutSessions.expire(sessionId);
        res.json({ success: true });
      } catch (sdkError) {
        console.error("[PayRex SDK] Expire Error:", sdkError.message);
        return res.status(500).json({
          error: "Failed to expire session",
          details: sdkError.message,
        });
      }
    } catch (error) {
      console.error("[PayRex] Expire error:", error);
      res.status(500).json({
        error: "Failed to expire session",
        details: error.message,
      });
    }
  }
);

/**
 * Get PayRex configuration status
 * GET /api/payments/status
 */
app.get("/api/payments/status", (req, res) => {
  res.json({
    configured: isPayRexConfigured(),
    mode: getPayRexMode(),
    message: getPayRexModeMessage(),
  });
});

// ============================================
// Notification Endpoints
// ============================================

/**
 * Get notification service status
 * GET /api/notifications/status
 */
app.get("/api/notifications/status", async (req, res) => {
  const notifStatus = getNotificationStatus();
  const emailStatus = getEmailStatus();
  const stats = await getNotificationStats();

  res.json({
    notifications: notifStatus,
    email: emailStatus,
    supabase: { configured: isSupabaseConfigured() },
    stats,
  });
});

/**
 * Manually trigger missed dose check
 * POST /api/notifications/check
 */
app.post("/api/notifications/check", notificationLimiter, async (req, res) => {
  console.log("[API] Manual notification check triggered");

  try {
    const results = await checkAndNotifyMissedDoses();
    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("[API] Notification check failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Send a test notification email
 * POST /api/notifications/test
 * Body: { email, name? }
 */
app.post(
  "/api/notifications/test",
  notificationLimiter,
  validateBody(testNotificationSchema),
  async (req, res) => {
    const { email, name } = req.body;

    console.log("[API] Sending test notification to:", email);

    try {
      const result = await sendTestNotification(email, name);
      res.json({
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });
    } catch (error) {
      console.error("[API] Test notification failed:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * Manually trigger prescription auto-expiration check
 * POST /api/prescriptions/expire-check
 * Useful for testing or manual maintenance
 */
app.post(
  "/api/prescriptions/expire-check",
  notificationLimiter,
  async (req, res) => {
    console.log("[API] Manual auto-expiration check triggered");

    try {
      const result = await runAutoExpiration();
      res.json({
        success: true,
        expired: result.expired,
        expiringSoon: result.expiringSoon,
        errors: result.errors,
      });
    } catch (error) {
      console.error("[API] Auto-expiration check failed:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * Get prescriptions expiring soon across all users
 * GET /api/prescriptions/expiring-soon
 */
app.get("/api/prescriptions/expiring-soon", async (req, res) => {
  const days = parseInt(req.query.days) || 3;

  try {
    const { medications, error } = await getAllExpiringMedications(days);

    if (error) {
      return res.status(500).json({ success: false, error });
    }

    res.json({
      success: true,
      count: medications.length,
      medications: medications.map((m) => ({
        id: m.id,
        name: m.name,
        endDate: m.endDate,
        daysRemaining: m.daysRemaining,
        userName: m.userName,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching expiring prescriptions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Verify email connection
 * GET /api/notifications/verify-email
 */
app.get("/api/notifications/verify-email", async (req, res) => {
  const result = await verifyConnection();
  res.json(result);
});

/**
 * Get notification history/stats
 * GET /api/notifications/stats
 */
app.get("/api/notifications/stats", async (req, res) => {
  const stats = await getNotificationStats();
  res.json(stats);
});

// ============================================
// Patient Reminder Endpoints
// ============================================

/**
 * Get patient reminder service status
 * GET /api/reminders/status
 */
app.get("/api/reminders/status", (req, res) => {
  res.json({
    reminders: getPatientReminderStatus(),
  });
});

/**
 * Manually trigger patient reminder check
 * POST /api/reminders/check
 */
app.post("/api/reminders/check", notificationLimiter, async (req, res) => {
  console.log("[API] Manual patient reminder check triggered");

  try {
    const results = await checkAndSendPatientReminders();
    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("[API] Patient reminder check failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// Push Notification Endpoints
// ============================================

/**
 * Get VAPID public key for push subscription
 * GET /api/push/vapid-key
 */
app.get("/api/push/vapid-key", (req, res) => {
  const publicKey = getVapidPublicKey();

  if (!publicKey) {
    return res.status(503).json({
      error: "Push notifications not configured",
      details: "VAPID keys not set on server",
    });
  }

  res.json({ publicKey });
});

/**
 * Get push notification status
 * GET /api/push/status
 */
app.get("/api/push/status", (req, res) => {
  res.json({
    push: getPushNotificationStatus(),
    configured: isPushNotificationConfigured(),
  });
});

/**
 * Subscribe to push notifications
 * POST /api/push/subscribe
 * Body: { userId, subscription: { endpoint, keys: { p256dh, auth } } }
 */
const pushSubscribeSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  subscription: z.object({
    endpoint: z.string().url("Invalid endpoint URL"),
    keys: z.object({
      p256dh: z.string().min(1, "p256dh key is required"),
      auth: z.string().min(1, "auth key is required"),
    }),
  }),
});

app.post(
  "/api/push/subscribe",
  notificationLimiter,
  validateBody(pushSubscribeSchema),
  async (req, res) => {
    try {
      const { userId, subscription } = req.body;

      if (!isPushNotificationConfigured()) {
        return res.status(503).json({
          error: "Push notifications not configured",
        });
      }

      console.log("[Push] Subscribing user:", userId);

      const result = await savePushSubscription(userId, subscription);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error,
        });
      }

      res.json({
        success: true,
        created: result.created,
        updated: result.updated,
      });
    } catch (error) {
      console.error("[Push] Subscribe error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * Unsubscribe from push notifications
 * POST /api/push/unsubscribe
 * Body: { userId, endpoint }
 */
const pushUnsubscribeSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  endpoint: z.string().url("Invalid endpoint URL"),
});

app.post(
  "/api/push/unsubscribe",
  notificationLimiter,
  validateBody(pushUnsubscribeSchema),
  async (req, res) => {
    try {
      const { userId, endpoint } = req.body;

      console.log("[Push] Unsubscribing user:", userId);

      const result = await removePushSubscription(userId, endpoint);

      res.json({
        success: result.success,
        error: result.error,
      });
    } catch (error) {
      console.error("[Push] Unsubscribe error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * Send a test push notification
 * POST /api/push/test
 * Body: { userId }
 */
const pushTestSchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

app.post(
  "/api/push/test",
  notificationLimiter,
  validateBody(pushTestSchema),
  async (req, res) => {
    try {
      const { userId } = req.body;

      if (!isPushNotificationConfigured()) {
        return res.status(503).json({
          error: "Push notifications not configured",
        });
      }

      console.log("[Push] Sending test notification to:", userId);

      const result = await sendTestPushNotification(userId);

      res.json(result);
    } catch (error) {
      console.error("[Push] Test notification error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================
// Cron Job - Check for missed doses
// TIERED: Runs every 30 seconds for demo, check push at 30s, 1min, email at 3min
// ============================================

// Schedule: Every 30 seconds for demo presentation (to catch 30-second push threshold)
// Use "*/30 * * * * *" for every 30 seconds (6 fields = with seconds)
// Use "* * * * *" for every minute (5 fields = standard cron)
const CRON_SCHEDULE = process.env.NOTIFICATION_CRON || "*/30 * * * * *";
let cronJob = null;

function startNotificationCron() {
  if (!isSupabaseConfigured()) {
    console.log("[Cron] Supabase not configured, skipping notification cron");
    return;
  }

  if (!isEmailConfigured()) {
    console.log("[Cron] Email not configured, skipping notification cron");
    return;
  }

  console.log(
    `[Cron] Starting notification check job (schedule: ${CRON_SCHEDULE})`
  );

  cronJob = cron.schedule(CRON_SCHEDULE, async () => {
    const now = new Date();
    console.log(
      `[Cron] Running tiered notification check at ${now.toLocaleTimeString()}`
    );

    try {
      const results = await checkAndNotifyMissedDoses();
      if (results.notified > 0) {
        console.log(
          `[Cron] Sent ${results.pushSent || 0} push + ${
            results.emailSent || 0
          } email = ${results.notified} total`
        );
      }
      if (results.errors.length > 0) {
        console.error("[Cron] Errors:", results.errors);
      }
    } catch (error) {
      console.error("[Cron] Notification check failed:", error);
    }
  });

  console.log("[Cron] Notification job started");
}

function stopNotificationCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("[Cron] Notification job stopped");
  }
}

// ============================================
// Cron Job - Patient Medication Reminders
// Sends reminders to patients before scheduled medication time
// ============================================

// Schedule: Every 2 minutes (to catch 5-minute before reminders accurately)
const PATIENT_REMINDER_SCHEDULE =
  process.env.PATIENT_REMINDER_CRON || "*/2 * * * *";
let patientReminderCronJob = null;

function startPatientReminderCron() {
  if (!isSupabaseConfigured()) {
    console.log(
      "[Cron] Supabase not configured, skipping patient reminder cron"
    );
    return;
  }

  if (!isEmailConfigured()) {
    console.log("[Cron] Email not configured, skipping patient reminder cron");
    return;
  }

  console.log(
    `[Cron] Starting patient reminder job (schedule: ${PATIENT_REMINDER_SCHEDULE})`
  );

  patientReminderCronJob = cron.schedule(
    PATIENT_REMINDER_SCHEDULE,
    async () => {
      const now = new Date();
      console.log(
        `[Cron] Running patient reminder check at ${now.toLocaleTimeString()}`
      );

      try {
        const results = await checkAndSendPatientReminders();
        if (results.sent > 0) {
          console.log(`[Cron] Sent ${results.sent} patient reminder(s)`);
        }
        if (results.errors.length > 0) {
          console.error("[Cron] Patient reminder errors:", results.errors);
        }
      } catch (error) {
        console.error("[Cron] Patient reminder check failed:", error);
      }
    }
  );

  console.log("[Cron] Patient reminder job started");
}

function stopPatientReminderCron() {
  if (patientReminderCronJob) {
    patientReminderCronJob.stop();
    patientReminderCronJob = null;
    console.log("[Cron] Patient reminder job stopped");
  }
}

// ============================================
// CRON: AUTO-EXPIRATION JOB
// Runs daily at midnight to expire prescriptions that have ended
// ============================================

let autoExpireCronJob = null;

// Schedule: Every day at midnight
const AUTO_EXPIRE_SCHEDULE = process.env.AUTO_EXPIRE_CRON || "0 0 * * *";

async function runAutoExpiration() {
  console.log("[AutoExpire] Running daily prescription expiration check...");

  try {
    // Auto-expire medications that have passed their end_date
    const {
      expiredCount,
      expiredMedications,
      error: expireError,
    } = await autoExpireAllMedications();

    if (expireError) {
      console.error("[AutoExpire] Error:", expireError);
      return { expired: 0, notified: 0, errors: [expireError] };
    }

    if (expiredCount > 0) {
      console.log(`[AutoExpire] Expired ${expiredCount} prescription(s)`);

      // Notify companions about expired prescriptions
      if (isEmailConfigured()) {
        await notifyCompanionsAboutExpiredPrescriptions(expiredMedications);
      }
    }

    // Check for prescriptions expiring in the next 3 days
    const { medications: expiringSoon } = await getAllExpiringMedications(3);

    if (expiringSoon.length > 0) {
      console.log(
        `[AutoExpire] ${expiringSoon.length} prescription(s) expiring within 3 days`
      );

      // Notify companions about prescriptions expiring soon
      if (isEmailConfigured()) {
        await notifyCompanionsAboutExpiringSoon(expiringSoon);
      }
    }

    return {
      expired: expiredCount,
      expiringSoon: expiringSoon.length,
      errors: [],
    };
  } catch (error) {
    console.error("[AutoExpire] Failed:", error);
    return { expired: 0, expiringSoon: 0, errors: [error.message] };
  }
}

async function notifyCompanionsAboutExpiredPrescriptions(expiredMedications) {
  if (!expiredMedications || expiredMedications.length === 0) return;

  // Group by patient
  const byPatient = new Map();
  for (const med of expiredMedications) {
    const existing = byPatient.get(med.userId) || {
      meds: [],
      userName: med.userName,
    };
    existing.meds.push(med);
    byPatient.set(med.userId, existing);
  }

  // Get companions for all patients in one query
  const patientIds = Array.from(byPatient.keys());
  const { companionsByPatient } = await getLinkedCompanionsForPatients(
    patientIds
  );

  let notificationsSent = 0;

  for (const [patientId, { meds, userName }] of byPatient) {
    const companions = companionsByPatient.get(patientId) || [];

    for (const companion of companions) {
      if (!companion.email) continue;

      const medNames = meds.map((m) => m.name).join(", ");

      try {
        await sendEmail({
          to: companion.email,
          subject: `⚠️ Prescription Completed for ${userName}`,
          html: `
            <h2>Prescription(s) Completed</h2>
            <p>Hello ${companion.name},</p>
            <p>The following prescription(s) for <strong>${userName}</strong> have completed their course:</p>
            <ul>
              ${meds
                .map(
                  (m) =>
                    `<li><strong>${m.name}</strong> (ended: ${m.endDate})</li>`
                )
                .join("")}
            </ul>
            <p>If ${userName} needs to continue taking these medications, please consult with their doctor for a refill prescription.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">This notification was sent by AInay Companion Care.</p>
          `,
          text: `Prescription(s) Completed for ${userName}:\n\n${medNames}\n\nPlease consult with their doctor if a refill is needed.`,
        });
        notificationsSent++;
      } catch (error) {
        console.error(
          `[AutoExpire] Failed to notify ${companion.email}:`,
          error
        );
      }
    }
  }

  console.log(
    `[AutoExpire] Sent ${notificationsSent} expiration notification(s)`
  );
}

async function notifyCompanionsAboutExpiringSoon(expiringMedications) {
  if (!expiringMedications || expiringMedications.length === 0) return;

  // Group by patient
  const byPatient = new Map();
  for (const med of expiringMedications) {
    const existing = byPatient.get(med.userId) || {
      meds: [],
      userName: med.userName,
    };
    existing.meds.push(med);
    byPatient.set(med.userId, existing);
  }

  // Get companions for all patients in one query
  const patientIds = Array.from(byPatient.keys());
  const { companionsByPatient } = await getLinkedCompanionsForPatients(
    patientIds
  );

  let notificationsSent = 0;

  for (const [patientId, { meds, userName }] of byPatient) {
    const companions = companionsByPatient.get(patientId) || [];

    for (const companion of companions) {
      if (!companion.email) continue;

      try {
        await sendEmail({
          to: companion.email,
          subject: `📅 Prescription(s) Ending Soon for ${userName}`,
          html: `
            <h2>Prescription(s) Ending Soon</h2>
            <p>Hello ${companion.name},</p>
            <p>The following prescription(s) for <strong>${userName}</strong> are ending soon:</p>
            <ul>
              ${meds
                .map(
                  (m) => `
                <li>
                  <strong>${m.name}</strong> - 
                  ${
                    m.daysRemaining === 0
                      ? "Ends today!"
                      : `${m.daysRemaining} day(s) remaining`
                  }
                  (ends: ${m.endDate})
                </li>
              `
                )
                .join("")}
            </ul>
            <p>Please consider scheduling a doctor's appointment or pharmacy refill if ${userName} needs to continue these medications.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">This notification was sent by AInay Companion Care.</p>
          `,
          text: `Prescription(s) ending soon for ${userName}:\n\n${meds
            .map((m) => `${m.name} - ${m.daysRemaining} day(s) remaining`)
            .join("\n")}\n\nPlease arrange for a refill if needed.`,
        });
        notificationsSent++;
      } catch (error) {
        console.error(
          `[AutoExpire] Failed to notify ${companion.email}:`,
          error
        );
      }
    }
  }

  console.log(
    `[AutoExpire] Sent ${notificationsSent} expiring-soon notification(s)`
  );
}

function startAutoExpireCron() {
  if (!isSupabaseConfigured()) {
    console.log(
      "[AutoExpire] Supabase not configured, skipping auto-expire cron"
    );
    return;
  }

  console.log(
    `[AutoExpire] Starting daily job (schedule: ${AUTO_EXPIRE_SCHEDULE})`
  );

  autoExpireCronJob = cron.schedule(AUTO_EXPIRE_SCHEDULE, async () => {
    await runAutoExpiration();
  });

  console.log("[AutoExpire] Daily expiration job started");
}

function stopAutoExpireCron() {
  if (autoExpireCronJob) {
    autoExpireCronJob.stop();
    autoExpireCronJob = null;
    console.log("[AutoExpire] Daily expiration job stopped");
  }
}

// ============================================
// In-Memory Storage with Automatic Cleanup
// OPTIMIZATION: Periodic cleanup to prevent memory leaks
// ============================================

// In-memory storage for demo sessions
const demoSessions = new Map();

// In-memory storage for checkout reference mappings (txn_ref -> session_id)
// This allows us to find the session ID even if localStorage is cleared
const checkoutReferences = new Map();

// Session TTL configuration (in milliseconds)
const SESSION_TTL = {
  demo: 24 * 60 * 60 * 1000, // 24 hours for demo sessions
  checkout: 2 * 60 * 60 * 1000, // 2 hours for checkout references
};

/**
 * Clean up expired sessions from in-memory storage
 * OPTIMIZATION: Prevents unbounded memory growth
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  let cleanedDemos = 0;
  let cleanedRefs = 0;

  // Clean up old demo sessions
  for (const [sessionId, data] of demoSessions.entries()) {
    const createdTime = new Date(data.createdAt).getTime();
    if (now - createdTime > SESSION_TTL.demo) {
      demoSessions.delete(sessionId);
      cleanedDemos++;
    }
  }

  // Clean up old checkout references
  for (const [txnRef, data] of checkoutReferences.entries()) {
    const createdTime = new Date(data.createdAt).getTime();
    if (now - createdTime > SESSION_TTL.checkout) {
      checkoutReferences.delete(txnRef);
      cleanedRefs++;
    }
  }

  if (cleanedDemos > 0 || cleanedRefs > 0) {
    console.log(
      `[Cleanup] Removed ${cleanedDemos} demo sessions, ${cleanedRefs} checkout references`
    );
  }
}

// OPTIMIZATION: Run cleanup every 15 minutes
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
let cleanupInterval = null;

function startSessionCleanup() {
  cleanupInterval = setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL);
  console.log("[Cleanup] Session cleanup job started (every 15 min)");
}

function stopSessionCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("[Cleanup] Session cleanup job stopped");
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create a demo/simulated checkout session when PayRex is unavailable
 * This allows the app to work for hackathon demos without real PayRex integration
 */
function createDemoCheckoutSession(res, userId, payload) {
  const demoSessionId = `demo_${Date.now()}_${Math.random()
    .toString(36)
    .substring(7)}`;

  // For demo mode, we'll return a special URL that the frontend can detect
  // The frontend should handle demo:// URLs to show a simulated checkout
  const demoCheckoutUrl = `${payload.success_url.replace(
    "{CHECKOUT_SESSION_ID}",
    demoSessionId
  )}`;

  console.log("[PayRex DEMO] Created demo session:", demoSessionId);

  // Store demo session for verification (in memory for demo purposes)
  demoSessions.set(demoSessionId, {
    id: demoSessionId,
    userId,
    status: "completed", // Auto-complete for demo
    tier: payload.metadata?.tier || "pro",
    createdAt: new Date().toISOString(),
  });

  res.json({
    success: true,
    checkoutUrl: demoCheckoutUrl,
    sessionId: demoSessionId,
    demo: true, // Flag to indicate this is a demo session
  });
}

function isPayRexConfigured() {
  return !!PAYREX_SECRET_KEY && PAYREX_SECRET_KEY.length > 10;
}

function getPayRexMode() {
  if (!isPayRexConfigured()) return "unconfigured";
  if (PAYREX_SECRET_KEY.startsWith("sk_test_")) return "test";
  if (PAYREX_SECRET_KEY.startsWith("sk_live_")) return "live";
  return "unknown";
}

function getPayRexModeMessage() {
  const mode = getPayRexMode();
  switch (mode) {
    case "unconfigured":
      return "PayRex not configured. Add PAYREX_SECRET_KEY to environment.";
    case "test":
      return "Running in TEST mode - No real charges will be made.";
    case "live":
      return "Running in LIVE mode - Real charges will be processed.";
    default:
      return "PayRex mode unknown - Please verify your API key.";
  }
}

// ============================================
// Start Server
// ============================================

app.listen(PORT, async () => {
  const supabaseStatus = isSupabaseConfigured()
    ? "✅ Configured"
    : "❌ Not configured";
  const emailProvider = isUsingBrevo() ? "Brevo" : "SMTP";
  const emailStatus = isEmailConfigured()
    ? `✅ ${emailProvider}`
    : "❌ Not configured";
  const payrexStatus = isPayRexConfigured()
    ? "✅ Configured"
    : "❌ Not configured";
  const pushStatus = isPushNotificationConfigured()
    ? "✅ Configured"
    : "❌ Not configured";
  const openaiStatus = isOpenAIConfigured()
    ? "✅ Configured"
    : "❌ Not configured";

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    AInay Backend Server                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Services Status:                                             ║
║    • Supabase:      ${supabaseStatus.padEnd(20)}                ║
║    • Email:         ${emailStatus.padEnd(20)}                ║
║    • PayRex:        ${payrexStatus.padEnd(20)}                ║
║    • Web Push:      ${pushStatus.padEnd(20)}                ║
║    • OpenAI:        ${openaiStatus.padEnd(20)}                ║
╠═══════════════════════════════════════════════════════════════╣
║  Tiered Notifications (for Demo):                             ║
║    • 30 sec: 🔔 First push notification                       ║
║    • 1 min:  🔔🔔 Second push reminder                        ║
║    • 3 min:  📧 Email notification                            ║
║    • Cron:   Every 30 seconds                                 ║
╠═══════════════════════════════════════════════════════════════╣
║  Optimizations:                                               ║
║    • Rate limiting: ✅ Enabled                                ║
║    • Request validation: ✅ Zod schemas                       ║
║    • Session cleanup: ✅ Every 15 min                         ║
╚═══════════════════════════════════════════════════════════════╝

Payment Endpoints:
  POST /api/payments/checkout     - Create checkout session
  GET  /api/payments/verify/:id   - Verify payment status
  POST /api/payments/expire/:id   - Expire a session
  GET  /api/payments/status       - Get configuration status

Notification Endpoints:
  GET  /api/notifications/status  - Get notification service status
  POST /api/notifications/check   - Manually trigger missed dose check
  POST /api/notifications/test    - Send a test notification email
  GET  /api/notifications/verify-email - Verify SMTP connection
  GET  /api/notifications/stats   - Get notification statistics

Push Notification Endpoints:
  GET  /api/push/vapid-key        - Get VAPID public key for subscription
  GET  /api/push/status           - Get push notification status
  POST /api/push/subscribe        - Subscribe to push notifications
  POST /api/push/unsubscribe      - Unsubscribe from push notifications
  POST /api/push/test             - Send a test push notification

Patient Reminder Endpoints:
  GET  /api/reminders/status            - Get patient reminder service status
  POST /api/reminders/check             - Manually trigger patient reminder check

Prescription Expiration Endpoints:
  POST /api/prescriptions/expire-check  - Manually trigger expiration check
  GET  /api/prescriptions/expiring-soon - Get prescriptions expiring soon

OpenAI Proxy Endpoints:
  POST /api/openai/chat           - Chat completions (including vision)
  POST /api/openai/transcribe     - Audio transcription (Whisper)
  POST /api/openai/tts            - Text-to-speech

Health:
  GET  /api/health                - Health check
`);

  // Start notification cron job
  startNotificationCron();

  // Start patient reminder cron job (checks every 2 minutes)
  startPatientReminderCron();

  // Start auto-expiration cron job (runs daily at midnight)
  startAutoExpireCron();

  // OPTIMIZATION: Start session cleanup job
  startSessionCleanup();

  // Show configuration hints
  if (!isSupabaseConfigured()) {
    console.log("⚠️  SUPABASE not configured. Add to .env:");
    console.log("   SUPABASE_URL=https://your-project.supabase.co");
    console.log("   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key\n");
  }

  if (!isEmailConfigured()) {
    console.log("⚠️  EMAIL not configured. Add Brevo API key to .env:");
    console.log("   BREVO_API_KEY=xkeysib-your-api-key");
    console.log("   EMAIL_FROM_ADDRESS=verified-sender@yourdomain.com");
    console.log(
      "   Get your API key at: https://app.brevo.com/settings/keys/api\n"
    );
  }

  if (!isPayRexConfigured()) {
    console.log("⚠️  PAYREX not configured. Add to .env:");
    console.log("   PAYREX_SECRET_KEY=sk_test_your_key_here\n");
  }

  if (!isPushNotificationConfigured()) {
    console.log(
      "⚠️  WEB PUSH not configured. Generate VAPID keys and add to .env:"
    );
    console.log("   npx web-push generate-vapid-keys");
    console.log("   VAPID_PUBLIC_KEY=your-public-key");
    console.log("   VAPID_PRIVATE_KEY=your-private-key\n");
  }

  if (!isOpenAIConfigured()) {
    console.log("⚠️  OPENAI not configured. Add to .env:");
    console.log("   OPENAI_API_KEY=sk-your-openai-api-key");
    console.log(
      "   Get your API key at: https://platform.openai.com/api-keys\n"
    );
  }

  // Verify email connection if configured
  if (isEmailConfigured()) {
    const emailVerify = await verifyConnection();
    if (emailVerify.success) {
      console.log("✅ Email SMTP connection verified successfully\n");
    } else {
      console.log(`❌ Email SMTP connection failed: ${emailVerify.error}\n`);
    }
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  stopNotificationCron();
  stopPatientReminderCron();
  stopAutoExpireCron();
  stopSessionCleanup();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down...");
  stopNotificationCron();
  stopPatientReminderCron();
  stopAutoExpireCron();
  stopSessionCleanup();
  process.exit(0);
});
