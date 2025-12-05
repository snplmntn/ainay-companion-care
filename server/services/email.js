// ============================================
// Email Service using Brevo (Sendinblue) API
// ============================================

import * as Brevo from "@getbrevo/brevo";

// Brevo API Configuration
// Free tier: 300 emails/day
// Get your API key from: https://app.brevo.com/settings/keys/api
const BREVO_API_KEY =
  process.env.BREVO_API_KEY || process.env.BREVO_SMTP_KEY || "";

// Email sender details
// IMPORTANT: Sender email must be verified in Brevo dashboard
const SENDER_CONFIG = {
  name: process.env.EMAIL_FROM_NAME || "AInay Companion Care",
  email: process.env.EMAIL_FROM_ADDRESS || "noreply@ainay.care",
};

// Initialize Brevo API client
let apiInstance = null;

function getApiInstance() {
  if (!apiInstance) {
    apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      Brevo.TransactionalEmailsApiApiKeys.apiKey,
      BREVO_API_KEY
    );
  }
  return apiInstance;
}

/**
 * Check if email is configured
 */
export function isEmailConfigured() {
  return !!BREVO_API_KEY && BREVO_API_KEY.startsWith("xkeysib-");
}

/**
 * Check if using Brevo
 */
export function isUsingBrevo() {
  return true; // Always using Brevo API
}

/**
 * Verify API connection by getting account info
 */
export async function verifyConnection() {
  if (!isEmailConfigured()) {
    return { success: false, error: "Brevo API key not configured" };
  }

  try {
    const accountApi = new Brevo.AccountApi();
    accountApi.setApiKey(Brevo.AccountApiApiKeys.apiKey, BREVO_API_KEY);
    await accountApi.getAccount();
    return { success: true, error: null };
  } catch (error) {
    console.error("[Email] API verification failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send email using Brevo API
 */
export async function sendEmail({ to, subject, htmlContent, textContent }) {
  if (!isEmailConfigured()) {
    console.warn("[Email] Brevo API not configured, skipping email");
    return { success: false, error: "Brevo API not configured" };
  }

  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.textContent = textContent;
  sendSmtpEmail.sender = {
    name: SENDER_CONFIG.name,
    email: SENDER_CONFIG.email,
  };
  sendSmtpEmail.to = [{ email: to }];

  try {
    const result = await getApiInstance().sendTransacEmail(sendSmtpEmail);
    console.log("[Email] Sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId, error: null };
  } catch (error) {
    console.error("[Email] Send failed:", error.message);
    return { success: false, messageId: null, error: error.message };
  }
}

// ============================================
// Email Template Base Styles
// ============================================
const BASE_STYLES = {
  fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  primaryTeal: "#0D9488",
  primaryTealLight: "#14B8A6",
  primaryTealDark: "#0F766E",
  alertRed: "#DC2626",
  alertRedLight: "#FEE2E2",
  warningOrange: "#F59E0B",
  warningOrangeLight: "#FEF3C7",
  successGreen: "#059669",
  successGreenLight: "#D1FAE5",
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  bgLight: "#F9FAFB",
  bgCard: "#FFFFFF",
  borderLight: "#E5E7EB",
};

/**
 * Generate base email wrapper
 */
function getEmailWrapper(content, accentColor = BASE_STYLES.primaryTeal) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>AInay Companion Care</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .button { padding: 12px 30px !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${
    BASE_STYLES.bgLight
  }; font-family: ${BASE_STYLES.fontFamily};">
  <!-- Preview text (hidden) -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    AInay Companion Care - Your trusted medication companion
  </div>
  
  <!-- Main container -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${
    BASE_STYLES.bgLight
  };">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: ${
          BASE_STYLES.bgCard
        }; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
          ${content}
        </table>
        
        <!-- Footer -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; margin-top: 24px;">
          <tr>
            <td align="center" style="padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: ${
                BASE_STYLES.textSecondary
              };">
                <strong>AInay</strong> - Your Digital Health Companion
              </p>
              <p style="margin: 0; font-size: 12px; color: ${
                BASE_STYLES.textMuted
              };">
                This is an automated message from AInay Companion Care.<br>
                <a href="${
                  process.env.FRONTEND_URL || "https://ainay.care"
                }/profile" style="color: ${accentColor}; text-decoration: none;">Manage notification settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
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
  const subject = `🚨 Missed Medication Alert: ${patientName}`;
  const displayMinutes = Math.round(minutesMissed);

  const content = `
    <!-- Header with alert gradient -->
    <tr>
      <td style="background: linear-gradient(135deg, ${
        BASE_STYLES.alertRed
      } 0%, #EF4444 50%, #F87171 100%); padding: 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center;">
              <!-- Alert Icon -->
              <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: rgba(255,255,255,0.2); border-radius: 50%; display: inline-block; line-height: 80px;">
                <span style="font-size: 40px;">⚠️</span>
              </div>
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">
                Medication Alert
              </h1>
              <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.9);">
                Immediate attention required
              </p>
            </td>
          </tr>
          <!-- Curved separator -->
          <tr>
            <td style="height: 30px; background: ${
              BASE_STYLES.bgCard
            }; border-radius: 30px 30px 0 0;"></td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td style="padding: 10px 40px 40px 40px;">
        <p style="font-size: 17px; color: ${
          BASE_STYLES.textPrimary
        }; margin: 0 0 24px 0; line-height: 1.6;">
          Hello <strong>${companionName}</strong>,
        </p>
        
        <p style="font-size: 16px; color: ${
          BASE_STYLES.textSecondary
        }; margin: 0 0 24px 0; line-height: 1.6;">
          <strong style="color: ${
            BASE_STYLES.textPrimary
          };">${patientName}</strong> has missed their scheduled medication and may need your assistance.
        </p>
        
        <!-- Medication Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, ${
          BASE_STYLES.alertRedLight
        } 0%, #FEF2F2 100%); border-radius: 16px; border-left: 5px solid ${
    BASE_STYLES.alertRed
  }; margin-bottom: 24px;">
          <tr>
            <td style="padding: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 16px;">
                    <span style="display: inline-block; background: ${
                      BASE_STYLES.alertRed
                    }; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Missed Dose
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="45%" style="padding: 10px 0; vertical-align: top;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; color: ${
                            BASE_STYLES.textMuted
                          }; text-transform: uppercase; letter-spacing: 0.5px;">
                            💊 Medicine
                          </p>
                          <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${
                            BASE_STYLES.textPrimary
                          };">
                            ${medicationName}
                          </p>
                        </td>
                        <td width="45%" style="padding: 10px 0; vertical-align: top;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; color: ${
                            BASE_STYLES.textMuted
                          }; text-transform: uppercase; letter-spacing: 0.5px;">
                            📋 Dosage
                          </p>
                          <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${
                            BASE_STYLES.textPrimary
                          };">
                            ${dosage}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td width="45%" style="padding: 10px 0; vertical-align: top;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; color: ${
                            BASE_STYLES.textMuted
                          }; text-transform: uppercase; letter-spacing: 0.5px;">
                            🕐 Scheduled Time
                          </p>
                          <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${
                            BASE_STYLES.textPrimary
                          };">
                            ${scheduledTime}
                          </p>
                        </td>
                        <td width="45%" style="padding: 10px 0; vertical-align: top;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; color: ${
                            BASE_STYLES.textMuted
                          }; text-transform: uppercase; letter-spacing: 0.5px;">
                            ⏱️ Overdue By
                          </p>
                          <p style="margin: 0; font-size: 18px; font-weight: 700; color: ${
                            BASE_STYLES.alertRed
                          };">
                            ${displayMinutes} minutes
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Action prompt -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: ${
          BASE_STYLES.bgLight
        }; border-radius: 12px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <p style="margin: 0; font-size: 14px; color: ${
                BASE_STYLES.textSecondary
              }; line-height: 1.6;">
                💡 <strong>Suggested Action:</strong> Consider reaching out to ${patientName} to check on them and remind them about their medication.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- CTA Button -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <a href="${
                process.env.FRONTEND_URL || "https://ainay.care"
              }/companion" 
                 style="display: inline-block; background: linear-gradient(135deg, ${
                   BASE_STYLES.alertRed
                 } 0%, #EF4444 100%); color: #FFFFFF; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(220,38,38,0.3);">
                View Dashboard →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const htmlContent = getEmailWrapper(content, BASE_STYLES.alertRed);

  const textContent = `
🚨 MISSED MEDICATION ALERT

Hello ${companionName},

${patientName} has missed their scheduled medication:

💊 Medicine: ${medicationName}
📋 Dosage: ${dosage}
🕐 Scheduled Time: ${scheduledTime}
⏱️ Overdue By: ${displayMinutes} minutes

Please consider checking on ${patientName} to remind them about their medication.

---
This is an automated alert from AInay Companion Care.
  `.trim();

  return sendEmail({
    to: companionEmail,
    subject,
    htmlContent,
    textContent,
  });
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
  const adherenceRate =
    totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  // Determine status styling
  let statusConfig;
  if (adherenceRate >= 80) {
    statusConfig = {
      emoji: "🎉",
      label: "Excellent",
      color: BASE_STYLES.successGreen,
      bgColor: BASE_STYLES.successGreenLight,
      gradient: `linear-gradient(135deg, ${BASE_STYLES.successGreen} 0%, #10B981 100%)`,
    };
  } else if (adherenceRate >= 50) {
    statusConfig = {
      emoji: "⚡",
      label: "Needs Attention",
      color: BASE_STYLES.warningOrange,
      bgColor: BASE_STYLES.warningOrangeLight,
      gradient: `linear-gradient(135deg, ${BASE_STYLES.warningOrange} 0%, #FBBF24 100%)`,
    };
  } else {
    statusConfig = {
      emoji: "⚠️",
      label: "Critical",
      color: BASE_STYLES.alertRed,
      bgColor: BASE_STYLES.alertRedLight,
      gradient: `linear-gradient(135deg, ${BASE_STYLES.alertRed} 0%, #EF4444 100%)`,
    };
  }

  const subject = `${statusConfig.emoji} Daily Report: ${patientName} - ${adherenceRate}% Adherence`;

  const missedList =
    missedMedications.length > 0
      ? missedMedications
          .map(
            (m) => `
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid ${BASE_STYLES.borderLight};">
                <span style="font-weight: 500; color: ${BASE_STYLES.textPrimary};">${m.name}</span>
              </td>
              <td style="padding: 12px 16px; border-bottom: 1px solid ${BASE_STYLES.borderLight}; text-align: right;">
                <span style="color: ${BASE_STYLES.textMuted};">${m.time}</span>
              </td>
            </tr>
          `
          )
          .join("")
      : `
        <tr>
          <td colspan="2" style="padding: 20px; text-align: center;">
            <span style="font-size: 32px;">🎊</span>
            <p style="margin: 8px 0 0 0; color: ${BASE_STYLES.successGreen}; font-weight: 600;">
              All medications taken today!
            </p>
          </td>
        </tr>
      `;

  const content = `
    <!-- Header -->
    <tr>
      <td style="background: ${statusConfig.gradient}; padding: 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center;">
              <span style="font-size: 48px;">${statusConfig.emoji}</span>
              <h1 style="margin: 16px 0 8px 0; font-size: 28px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">
                Daily Report
              </h1>
              <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.9);">
                ${patientName}'s Medication Summary
              </p>
            </td>
          </tr>
          <tr>
            <td style="height: 30px; background: ${
              BASE_STYLES.bgCard
            }; border-radius: 30px 30px 0 0;"></td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td style="padding: 10px 40px 40px 40px;">
        <p style="font-size: 17px; color: ${
          BASE_STYLES.textPrimary
        }; margin: 0 0 24px 0; line-height: 1.6;">
          Hello <strong>${companionName}</strong>,
        </p>
        
        <!-- Adherence Score Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: ${
          BASE_STYLES.bgLight
        }; border-radius: 20px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 32px; text-align: center;">
              <!-- Circular Progress Indicator (visual approximation) -->
              <div style="width: 140px; height: 140px; margin: 0 auto 20px; border-radius: 50%; background: conic-gradient(${
                statusConfig.color
              } ${adherenceRate * 3.6}deg, ${BASE_STYLES.borderLight} ${
    adherenceRate * 3.6
  }deg); display: flex; align-items: center; justify-content: center; position: relative;">
                <div style="width: 110px; height: 110px; border-radius: 50%; background: ${
                  BASE_STYLES.bgLight
                }; position: absolute; top: 15px; left: 15px; display: flex; align-items: center; justify-content: center;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 35px 0;">
                        <span style="font-size: 36px; font-weight: 700; color: ${
                          statusConfig.color
                        };">${adherenceRate}%</span>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>
              
              <p style="margin: 0 0 8px 0; font-size: 14px; color: ${
                BASE_STYLES.textMuted
              }; text-transform: uppercase; letter-spacing: 1px;">
                Adherence Rate
              </p>
              <span style="display: inline-block; background: ${
                statusConfig.bgColor
              }; color: ${
    statusConfig.color
  }; font-size: 13px; font-weight: 600; padding: 6px 16px; border-radius: 20px;">
                ${statusConfig.label}
              </span>
              
              <p style="margin: 20px 0 0 0; font-size: 16px; color: ${
                BASE_STYLES.textSecondary
              };">
                <strong style="color: ${
                  BASE_STYLES.textPrimary
                };">${takenCount}</strong> of <strong style="color: ${
    BASE_STYLES.textPrimary
  };">${totalCount}</strong> medications taken
              </p>
            </td>
          </tr>
        </table>
        
        ${
          missedMedications.length > 0
            ? `
        <!-- Missed Medications Table -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: ${statusConfig.bgColor}; border-radius: 16px; margin-bottom: 24px; border: 1px solid ${statusConfig.color}20;">
          <tr>
            <td style="padding: 20px 20px 0 20px;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${statusConfig.color}; text-transform: uppercase; letter-spacing: 0.5px;">
                ⚠️ Missed Medications
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: ${BASE_STYLES.bgCard}; border-radius: 12px; overflow: hidden;">
                ${missedList}
              </table>
            </td>
          </tr>
        </table>
        `
            : missedList
        }
        
        <!-- Encouragement -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: ${
          BASE_STYLES.bgLight
        }; border-radius: 12px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <p style="margin: 0; font-size: 14px; color: ${
                BASE_STYLES.textSecondary
              }; line-height: 1.6;">
                💪 Keep encouraging <strong>${patientName}</strong> to maintain their medication schedule for better health outcomes!
              </p>
            </td>
          </tr>
        </table>
        
        <!-- CTA Button -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <a href="${
                process.env.FRONTEND_URL || "https://ainay.care"
              }/companion" 
                 style="display: inline-block; background: ${
                   statusConfig.gradient
                 }; color: #FFFFFF; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px ${
    statusConfig.color
  }40;">
                View Full Report →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const htmlContent = getEmailWrapper(content, statusConfig.color);

  const missedTextList =
    missedMedications.length > 0
      ? missedMedications.map((m) => `  • ${m.name} (${m.time})`).join("\n")
      : "  ✅ All medications taken!";

  const textContent = `
📊 DAILY REPORT - ${patientName}

Hello ${companionName},

Here's today's medication summary for ${patientName}:

📈 Adherence Rate: ${adherenceRate}%
   ${takenCount} of ${totalCount} medications taken

${
  missedMedications.length > 0
    ? `⚠️ Missed Medications:\n${missedTextList}`
    : "🎉 All medications were taken today!"
}

Keep encouraging ${patientName} to maintain their medication schedule!

---
This is an automated report from AInay Companion Care.
  `.trim();

  return sendEmail({
    to: companionEmail,
    subject,
    htmlContent,
    textContent,
  });
}

/**
 * Send an upcoming medication reminder email to a patient
 */
export async function sendMedicationReminderEmail({
  patientName,
  patientEmail,
  medicationName,
  dosage,
  scheduledTime,
  minutesUntil,
}) {
  const subject = `💊 Reminder: ${medicationName} in ${minutesUntil} minutes`;

  const content = `
    <!-- Header with teal gradient -->
    <tr>
      <td style="background: linear-gradient(135deg, ${
        BASE_STYLES.primaryTealDark
      } 0%, ${BASE_STYLES.primaryTeal} 50%, ${
    BASE_STYLES.primaryTealLight
  } 100%); padding: 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center;">
              <!-- Pill Icon -->
              <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: rgba(255,255,255,0.2); border-radius: 50%; display: inline-block; line-height: 80px;">
                <span style="font-size: 40px;">💊</span>
              </div>
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">
                Medication Reminder
              </h1>
              <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.9);">
                Time to prepare your medicine
              </p>
            </td>
          </tr>
          <!-- Curved separator -->
          <tr>
            <td style="height: 30px; background: ${
              BASE_STYLES.bgCard
            }; border-radius: 30px 30px 0 0;"></td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td style="padding: 10px 40px 40px 40px;">
        <p style="font-size: 17px; color: ${
          BASE_STYLES.textPrimary
        }; margin: 0 0 24px 0; line-height: 1.6;">
          Hello <strong>${patientName}</strong>,
        </p>
        
        <p style="font-size: 16px; color: ${
          BASE_STYLES.textSecondary
        }; margin: 0 0 24px 0; line-height: 1.6;">
          It's almost time for your medication. Please prepare to take it soon.
        </p>
        
        <!-- Medication Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #E6FFFA 0%, #F0FDFA 100%); border-radius: 16px; border-left: 5px solid ${
          BASE_STYLES.primaryTeal
        }; margin-bottom: 24px;">
          <tr>
            <td style="padding: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 16px;">
                    <span style="display: inline-block; background: ${
                      BASE_STYLES.primaryTeal
                    }; color: white; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Upcoming Dose
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="45%" style="padding: 10px 0; vertical-align: top;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; color: ${
                            BASE_STYLES.textMuted
                          }; text-transform: uppercase; letter-spacing: 0.5px;">
                            💊 Medicine
                          </p>
                          <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${
                            BASE_STYLES.textPrimary
                          };">
                            ${medicationName}
                          </p>
                        </td>
                        <td width="45%" style="padding: 10px 0; vertical-align: top;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; color: ${
                            BASE_STYLES.textMuted
                          }; text-transform: uppercase; letter-spacing: 0.5px;">
                            📋 Dosage
                          </p>
                          <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${
                            BASE_STYLES.textPrimary
                          };">
                            ${dosage}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td width="45%" style="padding: 10px 0; vertical-align: top;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; color: ${
                            BASE_STYLES.textMuted
                          }; text-transform: uppercase; letter-spacing: 0.5px;">
                            🕐 Scheduled Time
                          </p>
                          <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${
                            BASE_STYLES.textPrimary
                          };">
                            ${scheduledTime}
                          </p>
                        </td>
                        <td width="45%" style="padding: 10px 0; vertical-align: top;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; color: ${
                            BASE_STYLES.textMuted
                          }; text-transform: uppercase; letter-spacing: 0.5px;">
                            ⏰ Time Left
                          </p>
                          <p style="margin: 0; font-size: 18px; font-weight: 700; color: ${
                            BASE_STYLES.primaryTeal
                          };">
                            ${minutesUntil} minutes
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Tips -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: ${
          BASE_STYLES.bgLight
        }; border-radius: 12px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: ${
                BASE_STYLES.textPrimary
              };">
                💡 Quick Tips:
              </p>
              <ul style="margin: 0; padding-left: 20px; color: ${
                BASE_STYLES.textSecondary
              }; font-size: 14px; line-height: 1.8;">
                <li>Take with a full glass of water</li>
                <li>Check if it should be taken with or without food</li>
                <li>Mark as taken in AInay after you take it</li>
              </ul>
            </td>
          </tr>
        </table>
        
        <!-- CTA Button -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <a href="${process.env.FRONTEND_URL || "https://ainay.care"}" 
                 style="display: inline-block; background: linear-gradient(135deg, ${
                   BASE_STYLES.primaryTealDark
                 } 0%, ${
    BASE_STYLES.primaryTeal
  } 100%); color: #FFFFFF; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(13,148,136,0.3);">
                Open AInay →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const htmlContent = getEmailWrapper(content, BASE_STYLES.primaryTeal);

  const textContent = `
💊 MEDICATION REMINDER

Hello ${patientName},

It's almost time to take your medication:

💊 Medicine: ${medicationName}
📋 Dosage: ${dosage}
🕐 Scheduled Time: ${scheduledTime}
⏰ Time Left: ${minutesUntil} minutes

Quick Tips:
• Take with a full glass of water
• Check if it should be taken with or without food
• Mark as taken in AInay after you take it

---
This is an automated reminder from AInay Companion Care.
  `.trim();

  return sendEmail({
    to: patientEmail,
    subject,
    htmlContent,
    textContent,
  });
}

/**
 * Get email configuration status (safe for logging)
 */
export function getEmailStatus() {
  return {
    configured: isEmailConfigured(),
    provider: "Brevo API",
    apiKey: BREVO_API_KEY ? `${BREVO_API_KEY.substring(0, 12)}***` : "not set",
    from: `${SENDER_CONFIG.name} <${SENDER_CONFIG.email}>`,
  };
}
