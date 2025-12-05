// ============================================
// Email Service using SMTP (Nodemailer)
// ============================================

import nodemailer from 'nodemailer';

// SMTP Configuration from environment variables
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};

// Email sender details
const SENDER_CONFIG = {
  name: process.env.EMAIL_FROM_NAME || 'AInay Companion Care',
  email: process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'noreply@ainay.care',
};

// Create transporter (lazy initialization)
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(SMTP_CONFIG);
  }
  return transporter;
}

/**
 * Check if email is configured
 */
export function isEmailConfigured() {
  return !!SMTP_CONFIG.auth.user && !!SMTP_CONFIG.auth.pass;
}

/**
 * Verify SMTP connection
 */
export async function verifyConnection() {
  if (!isEmailConfigured()) {
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    await getTransporter().verify();
    return { success: true, error: null };
  } catch (error) {
    console.error('[Email] Connection verification failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a missed medication notification email to a companion
 */
export async function sendMissedMedicationEmail({
  companionName,
  companionEmail,
  patientName,
  medicationName,
  dosage,
  scheduledTime,
  minutesMissed,
}) {
  if (!isEmailConfigured()) {
    console.warn('[Email] SMTP not configured, skipping email');
    return { success: false, error: 'SMTP not configured' };
  }

  const subject = `⚠️ Missed Medication Alert: ${patientName}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Missed Medication Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Medication Alert</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">AInay Companion Care</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
        Hello <strong>${companionName}</strong>,
      </p>
      
      <div style="background-color: #FFF3F3; border-left: 4px solid #FF6B6B; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #333; margin: 0 0 15px 0;">
          <strong>${patientName}</strong> has missed their scheduled medication:
        </p>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 40%;">💊 Medicine:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${medicationName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">📋 Dosage:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${dosage}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">🕐 Scheduled Time:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${scheduledTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">⏱️ Missed By:</td>
            <td style="padding: 8px 0; color: #FF6B6B; font-weight: 600;">${minutesMissed} minutes</td>
          </tr>
        </table>
      </div>
      
      <p style="font-size: 14px; color: #666; margin: 0 0 20px 0;">
        Please consider checking on ${patientName} to remind them about their medication.
      </p>
      
      <div style="text-align: center; margin-top: 30px;">
        <p style="font-size: 12px; color: #999; margin: 0;">
          This is an automated alert from AInay Companion Care.
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #666; margin: 0;">
        AInay - Your Digital Health Companion<br>
        <a href="${process.env.FRONTEND_URL || 'https://ainay.care'}" style="color: #FF6B6B; text-decoration: none;">Visit Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
⚠️ MISSED MEDICATION ALERT

Hello ${companionName},

${patientName} has missed their scheduled medication:

💊 Medicine: ${medicationName}
📋 Dosage: ${dosage}
🕐 Scheduled Time: ${scheduledTime}
⏱️ Missed By: ${minutesMissed} minutes

Please consider checking on ${patientName} to remind them about their medication.

---
This is an automated alert from AInay Companion Care.
  `.trim();

  try {
    const info = await getTransporter().sendMail({
      from: `"${SENDER_CONFIG.name}" <${SENDER_CONFIG.email}>`,
      to: companionEmail,
      subject,
      text,
      html,
    });

    console.log('[Email] Sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId, error: null };
  } catch (error) {
    console.error('[Email] Send failed:', error);
    return { success: false, messageId: null, error: error.message };
  }
}

/**
 * Send a daily adherence summary to a companion
 */
export async function sendDailyAdherenceSummary({
  companionName,
  companionEmail,
  patientName,
  takenCount,
  totalCount,
  missedMedications,
}) {
  if (!isEmailConfigured()) {
    return { success: false, error: 'SMTP not configured' };
  }

  const adherenceRate = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;
  const statusEmoji = adherenceRate >= 80 ? '🎉' : adherenceRate >= 50 ? '⚠️' : '🚨';
  const statusColor = adherenceRate >= 80 ? '#4ECDC4' : adherenceRate >= 50 ? '#FFB347' : '#FF6B6B';

  const subject = `${statusEmoji} Daily Report: ${patientName} - ${adherenceRate}% Adherence`;

  const missedList = missedMedications.length > 0
    ? missedMedications.map(m => `<li style="padding: 5px 0;">${m.name} (${m.time})</li>`).join('')
    : '<li style="padding: 5px 0; color: #4ECDC4;">All medications taken! 🎉</li>';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Daily Adherence Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <div style="background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}CC 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">📊 Daily Report</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">${patientName}'s Medication Summary</p>
    </div>
    
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
        Hello <strong>${companionName}</strong>,
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; width: 120px; height: 120px; border-radius: 50%; background: conic-gradient(${statusColor} ${adherenceRate}%, #eee ${adherenceRate}%); padding: 10px;">
          <div style="width: 100%; height: 100%; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 28px; font-weight: bold; color: ${statusColor};">${adherenceRate}%</span>
          </div>
        </div>
        <p style="margin-top: 15px; color: #666; font-size: 14px;">
          ${takenCount} of ${totalCount} medications taken
        </p>
      </div>
      
      ${missedMedications.length > 0 ? `
      <div style="background-color: #FFF3F3; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 15px 0; color: #FF6B6B;">Missed Medications:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #333;">
          ${missedList}
        </ul>
      </div>
      ` : ''}
      
      <p style="font-size: 14px; color: #666;">
        Keep encouraging ${patientName} to maintain their medication schedule!
      </p>
    </div>
    
    <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #666; margin: 0;">
        AInay - Your Digital Health Companion
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const info = await getTransporter().sendMail({
      from: `"${SENDER_CONFIG.name}" <${SENDER_CONFIG.email}>`,
      to: companionEmail,
      subject,
      html,
    });

    return { success: true, messageId: info.messageId, error: null };
  } catch (error) {
    console.error('[Email] Send failed:', error);
    return { success: false, messageId: null, error: error.message };
  }
}

/**
 * Get SMTP configuration status (safe for logging)
 */
export function getEmailStatus() {
  return {
    configured: isEmailConfigured(),
    host: SMTP_CONFIG.host,
    port: SMTP_CONFIG.port,
    secure: SMTP_CONFIG.secure,
    user: SMTP_CONFIG.auth.user ? `${SMTP_CONFIG.auth.user.substring(0, 3)}***` : 'not set',
    from: `${SENDER_CONFIG.name} <${SENDER_CONFIG.email}>`,
  };
}

