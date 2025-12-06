// ============================================
// Date Service - Date/Day/Week Awareness
// ============================================

/**
 * Day names for friendly display
 */
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Get ordinal suffix for a day number (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export interface DateContext {
  /** Full date string: "Friday, December 5th, 2025" */
  fullDate: string;
  /** Day name: "Friday" */
  dayName: string;
  /** Month name: "December" */
  monthName: string;
  /** Day of month: 5 */
  dayOfMonth: number;
  /** Year: 2025 */
  year: number;
  /** Day of week (0-6, Sunday = 0) */
  dayOfWeek: number;
  /** Is it a weekend? */
  isWeekend: boolean;
  /** Week context message */
  weekContext: string;
  /** Day-specific greeting enhancement */
  dayGreeting: string;
}

/**
 * Get comprehensive date context for briefings
 */
export function getDateContext(date: Date = new Date()): DateContext {
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();

  const dayName = DAY_NAMES[dayOfWeek];
  const monthName = MONTH_NAMES[monthIndex];
  const ordinal = getOrdinalSuffix(dayOfMonth);

  const fullDate = `${dayName}, ${monthName} ${dayOfMonth}${ordinal}, ${year}`;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return {
    fullDate,
    dayName,
    monthName,
    dayOfMonth,
    year,
    dayOfWeek,
    isWeekend,
    weekContext: getWeekContext(dayOfWeek),
    dayGreeting: getDayGreeting(dayOfWeek),
  };
}

/**
 * Get context about where we are in the week
 */
function getWeekContext(dayOfWeek: number): string {
  switch (dayOfWeek) {
    case 0: // Sunday
      return "It's Sunday - a perfect day for rest and relaxation.";
    case 1: // Monday
      return "It's Monday - the start of a fresh new week!";
    case 2: // Tuesday
      return "It's Tuesday - we're getting into the swing of the week.";
    case 3: // Wednesday
      return "It's Wednesday - we're halfway through the week already!";
    case 4: // Thursday
      return "It's Thursday - almost there, the weekend is just around the corner!";
    case 5: // Friday
      return "Happy Friday! The weekend starts tomorrow.";
    case 6: // Saturday
      return "It's Saturday - enjoy your weekend!";
    default:
      return '';
  }
}

/**
 * Get a day-specific greeting enhancement
 */
function getDayGreeting(dayOfWeek: number): string {
  switch (dayOfWeek) {
    case 0:
      return 'Happy Sunday';
    case 1:
      return 'Happy Monday';
    case 5:
      return 'Happy Friday';
    case 6:
      return 'Happy Saturday';
    default:
      return '';
  }
}

/**
 * Format date for briefing prompt
 */
export function formatDateForBriefing(date: Date = new Date()): string {
  const ctx = getDateContext(date);
  return `Today is ${ctx.fullDate}. ${ctx.weekContext}`;
}


