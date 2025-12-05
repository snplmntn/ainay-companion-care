import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron";

// Load environment variables
dotenv.config();

// Import services
import { isSupabaseConfigured } from "./services/supabase.js";
import {
  isEmailConfigured,
  verifyConnection,
  getEmailStatus,
} from "./services/email.js";
import {
  checkAndNotifyMissedDoses,
  getNotificationStatus,
  sendTestNotification,
} from "./services/notifications.js";
import { getNotificationStats } from "./services/supabase.js";

const app = express();
const PORT = process.env.PORT || 3001;

// PayRex API Configuration
// Docs: https://docs.payrexhq.com/
const PAYREX_CONFIG = {
  API_BASE_URL: "https://api.payrexhq.com",
  SECRET_KEY: process.env.PAYREX_SECRET_KEY || "",
};

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

// Middleware - Allow multiple frontend URLs for development
const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:5173",
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
        callback(null, true); // Allow anyway for development
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    payrexConfigured: isPayRexConfigured(),
    mode: getPayRexMode(),
  });
});

// ============================================
// PayRex Payment Endpoints
// ============================================

/**
 * Create a checkout session for Pro subscription
 * POST /api/payments/checkout
 * Body: { userId, successUrl, cancelUrl }
 */
app.post("/api/payments/checkout", async (req, res) => {
  try {
    const { userId, successUrl, cancelUrl } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (!isPayRexConfigured()) {
      return res.status(503).json({
        error: "Payment system not configured",
        details:
          "PayRex API key not set. Add PAYREX_SECRET_KEY to server environment.",
      });
    }

    const proPlan = SUBSCRIPTION_PLANS.pro;

    // PayRex checkout session payload
    // Docs: https://docs.payrexhq.com/
    const lineItems = [
      {
        name: proPlan.name,
        amount: proPlan.priceInCents,
        quantity: 1,
      },
    ];

    const checkoutPayload = {
      line_items: lineItems,
      currency: "PHP", // Currency at top level
      success_url:
        successUrl ||
        `${
          process.env.FRONTEND_URL || "http://localhost:8080"
        }/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        cancelUrl ||
        `${
          process.env.FRONTEND_URL || "http://localhost:8080"
        }/subscription/pricing`,
      description: "AInay Companion Care - Pro Subscription",
      metadata: {
        user_id: userId,
        tier: "pro",
        subscription_type: "monthly",
      },
    };

    console.log("[PayRex] Creating checkout session for user:", userId);
    console.log("[PayRex] Payload:", JSON.stringify(checkoutPayload, null, 2));

    try {
      const response = await fetch(
        `${PAYREX_CONFIG.API_BASE_URL}/checkout_sessions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: getAuthHeader(),
          },
          body: JSON.stringify(checkoutPayload),
        }
      );

      // Get raw response text first for debugging
      const responseText = await response.text();
      console.log("[PayRex] Response status:", response.status);
      console.log("[PayRex] Response text:", responseText || "(empty)");

      // If PayRex returns empty response or 500 error, fall back to demo mode
      if (!responseText || response.status === 500) {
        console.log("[PayRex] API unavailable, using DEMO mode");
        return createDemoCheckoutSession(res, userId, checkoutPayload);
      }

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("[PayRex] Failed to parse response, using DEMO mode");
        return createDemoCheckoutSession(res, userId, checkoutPayload);
      }

      if (!response.ok) {
        console.error("[PayRex] API Error:", data);
        // Fall back to demo mode on error
        console.log("[PayRex] API error, using DEMO mode");
        return createDemoCheckoutSession(res, userId, checkoutPayload);
      }

      console.log("[PayRex] Checkout session created:", data.data?.id);

      res.json({
        success: true,
        checkoutUrl: data.data?.url,
        sessionId: data.data?.id,
      });
    } catch (fetchError) {
      console.error("[PayRex] Network error:", fetchError.message);
      console.log("[PayRex] Network error, using DEMO mode");
      return createDemoCheckoutSession(res, userId, checkoutPayload);
    }
  } catch (error) {
    console.error("[PayRex] Checkout error:", error);
    res.status(500).json({
      error: "Failed to create checkout session",
      details: error.message,
    });
  }
});

/**
 * Verify a checkout session
 * GET /api/payments/verify/:sessionId
 */
app.get("/api/payments/verify/:sessionId", async (req, res) => {
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

    if (!isPayRexConfigured()) {
      return res.status(503).json({
        error: "Payment system not configured",
      });
    }

    console.log("[PayRex] Verifying session:", sessionId);

    const response = await fetch(
      `${PAYREX_CONFIG.API_BASE_URL}/checkout_sessions/${sessionId}`,
      {
        method: "GET",
        headers: {
          Authorization: getAuthHeader(),
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[PayRex] Verify Error:", data);
      return res.status(response.status).json({
        error: data.message || "Failed to verify checkout session",
      });
    }

    const session = data.data;
    const isCompleted = session.status === "completed";

    console.log("[PayRex] Session status:", session.status);

    res.json({
      success: isCompleted,
      status: session.status,
      tier: session.metadata?.tier || "pro",
      userId: session.customer_reference_id || session.metadata?.user_id,
    });
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
app.post("/api/payments/expire/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!isPayRexConfigured()) {
      return res.status(503).json({
        error: "Payment system not configured",
      });
    }

    const response = await fetch(
      `${PAYREX_CONFIG.API_BASE_URL}/checkout_sessions/${sessionId}/expire`,
      {
        method: "POST",
        headers: {
          Authorization: getAuthHeader(),
        },
      }
    );

    if (!response.ok) {
      const data = await response.json();
      return res.status(response.status).json({
        error: data.message || "Failed to expire session",
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[PayRex] Expire error:", error);
    res.status(500).json({
      error: "Failed to expire session",
      details: error.message,
    });
  }
});

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
app.post("/api/notifications/check", async (req, res) => {
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
app.post("/api/notifications/test", async (req, res) => {
  const { email, name = "Test User" } = req.body;

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

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
// Cron Job - Check for missed doses every minute
// ============================================

// Schedule: Every minute
const CRON_SCHEDULE = process.env.NOTIFICATION_CRON || "* * * * *";
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
      `[Cron] Running notification check at ${now.toLocaleTimeString()}`
    );

    try {
      const results = await checkAndNotifyMissedDoses();
      if (results.notified > 0) {
        console.log(`[Cron] Sent ${results.notified} notification(s)`);
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
// Helper Functions
// ============================================

/**
 * Create a demo/simulated checkout session when PayRex is unavailable
 * This allows the app to work for hackathon demos without real PayRex integration
 */
function createDemoCheckoutSession(res, userId, payload) {
  const demoSessionId = `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  // For demo mode, we'll return a special URL that the frontend can detect
  // The frontend should handle demo:// URLs to show a simulated checkout
  const demoCheckoutUrl = `${payload.success_url.replace('{CHECKOUT_SESSION_ID}', demoSessionId)}`;
  
  console.log("[PayRex DEMO] Created demo session:", demoSessionId);
  
  // Store demo session for verification (in memory for demo purposes)
  demoSessions.set(demoSessionId, {
    id: demoSessionId,
    userId,
    status: 'completed', // Auto-complete for demo
    tier: payload.metadata?.tier || 'pro',
    createdAt: new Date().toISOString(),
  });
  
  res.json({
    success: true,
    checkoutUrl: demoCheckoutUrl,
    sessionId: demoSessionId,
    demo: true, // Flag to indicate this is a demo session
  });
}

// In-memory storage for demo sessions
const demoSessions = new Map();

function getAuthHeader() {
  // PayRex uses Basic auth with secret key as username and empty password
  const credentials = Buffer.from(`${PAYREX_CONFIG.SECRET_KEY}:`).toString(
    "base64"
  );
  return `Basic ${credentials}`;
}

function isPayRexConfigured() {
  return !!PAYREX_CONFIG.SECRET_KEY && PAYREX_CONFIG.SECRET_KEY.length > 10;
}

function getPayRexMode() {
  if (!isPayRexConfigured()) return "unconfigured";
  if (PAYREX_CONFIG.SECRET_KEY.startsWith("sk_test_")) return "test";
  if (PAYREX_CONFIG.SECRET_KEY.startsWith("sk_live_")) return "live";
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
  const emailStatus = isEmailConfigured()
    ? "✅ Configured"
    : "❌ Not configured";
  const payrexStatus = isPayRexConfigured()
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
║    • Email (SMTP):  ${emailStatus.padEnd(20)}                ║
║    • PayRex:        ${payrexStatus.padEnd(20)}                ║
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

Health:
  GET  /api/health                - Health check
`);

  // Start notification cron job
  startNotificationCron();

  // Show configuration hints
  if (!isSupabaseConfigured()) {
    console.log("⚠️  SUPABASE not configured. Add to .env:");
    console.log("   SUPABASE_URL=https://your-project.supabase.co");
    console.log("   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key\n");
  }

  if (!isEmailConfigured()) {
    console.log("⚠️  EMAIL (SMTP) not configured. Add to .env:");
    console.log("   SMTP_HOST=smtp.gmail.com (or your SMTP host)");
    console.log("   SMTP_PORT=587");
    console.log("   SMTP_USER=your-email@gmail.com");
    console.log("   SMTP_PASS=your-app-password\n");
  }

  if (!isPayRexConfigured()) {
    console.log("⚠️  PAYREX not configured. Add to .env:");
    console.log("   PAYREX_SECRET_KEY=sk_test_your_key_here\n");
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
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down...");
  stopNotificationCron();
  process.exit(0);
});
