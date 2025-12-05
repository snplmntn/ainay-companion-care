# AInay Backend Server

Express.js backend server for AInay Companion Care, handling:
- Payment processing (PayRex)
- **Missed medication notifications via email**
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

# Email (SMTP) Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM_NAME=AInay Companion Care
EMAIL_FROM_ADDRESS=noreply@ainay.care
```

### Notification Settings

```env
# Minutes after scheduled time to send notification (default: 15)
MISSED_DOSE_THRESHOLD=15

# Maximum minutes past to still send notification (default: 120)
MAX_NOTIFICATION_WINDOW=120

# Enable/disable notifications (default: true)
NOTIFICATIONS_ENABLED=true

# Cron schedule (default: every minute)
NOTIFICATION_CRON=* * * * *
```

### Payment Settings (Optional)

```env
PAYREX_SECRET_KEY=sk_test_your_key_here
```

## Gmail SMTP Setup

1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account → Security → App passwords
3. Create a new app password for "Mail"
4. Use the generated 16-character password as `SMTP_PASS`

## API Endpoints

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications/status` | Get notification service status |
| POST | `/api/notifications/check` | Manually trigger missed dose check |
| POST | `/api/notifications/test` | Send a test notification email |
| GET | `/api/notifications/verify-email` | Verify SMTP connection |
| GET | `/api/notifications/stats` | Get notification statistics |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/checkout` | Create checkout session |
| GET | `/api/payments/verify/:id` | Verify payment status |
| POST | `/api/payments/expire/:id` | Expire a session |
| GET | `/api/payments/status` | Get configuration status |

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
```

