# AInay Backend Server

Express.js backend server for AInay Companion Care, handling:

- Payment processing (PayRex)
- **Missed medication notifications via email**
- **Browser push notifications for companions**
- Cron job for automatic dose checking

## Quick Start

```bash
cd server
npm install
npm run dev
```

## Environment Variables

Create a `.env` file in the `server/` directory with the following:

### Required for Notifications

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Brevo (Sendinblue) SMTP Configuration
# Free tier: 300 emails/day
BREVO_SMTP_USER=your-brevo-login-email@example.com
BREVO_SMTP_KEY=xsmtpsib-xxxxxxxx-your-smtp-key
EMAIL_FROM_NAME=AInay Companion Care
EMAIL_FROM_ADDRESS=verified-sender@yourdomain.com
```

### Notification Settings (Tiered System)

Push notifications are sent FIRST, email comes LATER:

```env
# === TIERED THRESHOLDS (for Demo Presentation) ===
# First push notification (default: 0.5 min = 30 seconds)
PUSH_FIRST_THRESHOLD=0.5

# Second push reminder (default: 1 minute)
PUSH_SECOND_THRESHOLD=1

# Email notification (default: 3 minutes)
EMAIL_THRESHOLD=3

# Maximum minutes past to still send notification (default: 120)
MAX_NOTIFICATION_WINDOW=120

# Enable/disable notifications (default: true)
NOTIFICATIONS_ENABLED=true

# Cron schedule - every 30 seconds for demo (6 fields with seconds)
# Use "*/30 * * * * *" for every 30 seconds
# Use "* * * * *" for every minute (standard)
NOTIFICATION_CRON=*/30 * * * * *
```

**Notification Timeline:**

1. **30 seconds**: 🔔 First push notification sent
2. **1 minute**: 🔔🔔 Second push reminder sent
3. **3 minutes**: 📧 Email notification sent

### Push Notification Settings

```env
# VAPID keys for Web Push notifications
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:support@ainay.app
```

### Payment Settings (Optional)

```env
PAYREX_SECRET_KEY=sk_test_your_key_here
```

## Brevo Setup (Free - 300 emails/day)

1. Create a free account at [brevo.com](https://www.brevo.com)
2. Go to **Settings** → **SMTP & API** → **SMTP**
3. Generate an SMTP key (starts with `xsmtpsib-`)
4. Add a verified sender email in **Senders & Domains**
5. Copy credentials to your `.env` file:
   - `BREVO_SMTP_USER` = Your Brevo login email
   - `BREVO_SMTP_KEY` = The generated SMTP key
   - `EMAIL_FROM_ADDRESS` = Your verified sender email

### Alternative: Custom SMTP

You can also use any SMTP provider:

```env
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
```

## Web Push Setup (Browser Notifications)

Browser push notifications allow companions to receive instant alerts even when the app is closed.

### 1. Generate VAPID Keys

```bash
cd server
npx web-push generate-vapid-keys
```

This outputs:

```
Public Key: BXXXX...
Private Key: XXXXX...
```

### 2. Add to Environment

```env
VAPID_PUBLIC_KEY=BXXXX...
VAPID_PRIVATE_KEY=XXXXX...
VAPID_SUBJECT=mailto:your-email@example.com
```

### 3. Database Migration

Run the push subscriptions migration:

```sql
-- See supabase/migrations/add_push_subscriptions.sql
```

### 4. How It Works

1. Companions enable push notifications in the dashboard
2. Browser requests permission and creates a push subscription
3. Subscription is sent to server and stored in database
4. When missed dose is detected, server sends both email AND push notification
5. Service worker displays notification even if app is closed

## API Endpoints

### Notifications (Email)

| Method | Endpoint                          | Description                        |
| ------ | --------------------------------- | ---------------------------------- |
| GET    | `/api/notifications/status`       | Get notification service status    |
| POST   | `/api/notifications/check`        | Manually trigger missed dose check |
| POST   | `/api/notifications/test`         | Send a test notification email     |
| GET    | `/api/notifications/verify-email` | Verify SMTP connection             |
| GET    | `/api/notifications/stats`        | Get notification statistics        |

### Push Notifications (Browser)

| Method | Endpoint                | Description                      |
| ------ | ----------------------- | -------------------------------- |
| GET    | `/api/push/vapid-key`   | Get VAPID public key for clients |
| GET    | `/api/push/status`      | Get push notification status     |
| POST   | `/api/push/subscribe`   | Subscribe to push notifications  |
| POST   | `/api/push/unsubscribe` | Unsubscribe from notifications   |
| POST   | `/api/push/test`        | Send a test push notification    |

### Payments

| Method | Endpoint                   | Description              |
| ------ | -------------------------- | ------------------------ |
| POST   | `/api/payments/checkout`   | Create checkout session  |
| GET    | `/api/payments/verify/:id` | Verify payment status    |
| POST   | `/api/payments/expire/:id` | Expire a session         |
| GET    | `/api/payments/status`     | Get configuration status |

## How Notifications Work

1. **Cron Job** runs every minute (configurable)
2. **Checks** all medications that are:
   - Active (`is_active = true`)
   - Not taken (`taken = false`)
   - Past scheduled time by 15+ minutes
3. **Finds** linked companions for each patient
4. **Sends** email notifications (avoids duplicates per day)
5. **Records** notification history in database

## Database Schema

The server requires the `notification_history` table. Run the migration in `supabase/schema.sql`.

## Testing Notifications

```bash
# Send test email
curl -X POST http://localhost:3001/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test User"}'

# Manually trigger check
curl -X POST http://localhost:3001/api/notifications/check

# Send test push notification (requires userId)
curl -X POST http://localhost:3001/api/push/test \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid-here"}'
```
