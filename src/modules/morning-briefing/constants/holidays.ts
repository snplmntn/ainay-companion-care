// ============================================
// Holiday Detection - Philippine & International
// ============================================

export interface Holiday {
  name: string;
  /** Brief, warm message for the briefing */
  message: string;
  /** Whether it's a major holiday (affects greeting style) */
  isMajor: boolean;
}

/**
 * Fixed-date holidays (month-day format: "MM-DD")
 * Includes Philippine holidays and major international observances
 */
export const FIXED_HOLIDAYS: Record<string, Holiday> = {
  // === JANUARY ===
  '01-01': {
    name: "New Year's Day",
    message: "Happy New Year! May this year bring you health, happiness, and wonderful moments.",
    isMajor: true,
  },
  '01-23': {
    name: 'Chinese New Year',
    message: "It's Chinese New Year! Kung Hei Fat Choi - wishing you prosperity and good fortune.",
    isMajor: true,
  },

  // === FEBRUARY ===
  '02-14': {
    name: "Valentine's Day",
    message: "Happy Valentine's Day! A day to celebrate love and the people dear to us.",
    isMajor: false,
  },
  '02-25': {
    name: 'EDSA People Power Revolution Anniversary',
    message: "Today we commemorate the EDSA People Power Revolution, a historic moment for the Philippines.",
    isMajor: true,
  },

  // === MARCH ===
  '03-08': {
    name: "International Women's Day",
    message: "Happy International Women's Day! Celebrating the strength and achievements of women everywhere.",
    isMajor: false,
  },

  // === APRIL ===
  '04-09': {
    name: 'Araw ng Kagitingan (Day of Valor)',
    message: "Today is Araw ng Kagitingan, honoring the bravery of Filipino and American soldiers.",
    isMajor: true,
  },

  // === MAY ===
  '05-01': {
    name: 'Labor Day',
    message: "Happy Labor Day! A day to honor all hardworking individuals.",
    isMajor: true,
  },

  // === JUNE ===
  '06-12': {
    name: 'Independence Day (Philippines)',
    message: "Happy Independence Day! Celebrating the freedom and sovereignty of the Philippines.",
    isMajor: true,
  },
  '06-21': {
    name: "Father's Day",
    message: "Happy Father's Day! Celebrating all the wonderful fathers and father figures.",
    isMajor: false,
  },

  // === JULY ===
  // (Variable: Eid al-Adha - based on Islamic calendar)

  // === AUGUST ===
  '08-21': {
    name: 'Ninoy Aquino Day',
    message: "Today we remember Senator Ninoy Aquino and his sacrifice for democracy.",
    isMajor: true,
  },
  '08-26': {
    name: 'National Heroes Day',
    message: "Happy National Heroes Day! Honoring all Filipino heroes who shaped our nation.",
    isMajor: true,
  },

  // === SEPTEMBER ===
  '09-21': {
    name: "World Alzheimer's Day",
    message: "Today is World Alzheimer's Day - a reminder to care for our loved ones with compassion.",
    isMajor: false,
  },

  // === OCTOBER ===
  '10-01': {
    name: 'International Day of Older Persons',
    message: "Today celebrates older persons around the world - your wisdom and experience are treasured!",
    isMajor: false,
  },
  '10-31': {
    name: 'Halloween',
    message: "Happy Halloween! A spooky but fun day for all ages.",
    isMajor: false,
  },

  // === NOVEMBER ===
  '11-01': {
    name: "All Saints' Day",
    message: "Today is All Saints' Day - a time to remember and honor our departed loved ones.",
    isMajor: true,
  },
  '11-02': {
    name: "All Souls' Day",
    message: "Today is All Souls' Day - we pray for and remember those who have passed.",
    isMajor: true,
  },
  '11-30': {
    name: 'Bonifacio Day',
    message: "Happy Bonifacio Day! Honoring Andres Bonifacio, father of the Philippine Revolution.",
    isMajor: true,
  },

  // === DECEMBER ===
  '12-08': {
    name: 'Feast of the Immaculate Conception',
    message: "Today is the Feast of the Immaculate Conception - a special day of devotion.",
    isMajor: false,
  },
  '12-24': {
    name: 'Christmas Eve',
    message: "It's Christmas Eve! May the warmth of the season fill your heart with joy.",
    isMajor: true,
  },
  '12-25': {
    name: 'Christmas Day',
    message: "Merry Christmas! May your day be filled with love, peace, and happiness.",
    isMajor: true,
  },
  '12-26': {
    name: 'Boxing Day',
    message: "Happy Boxing Day! Hope you're enjoying the holiday season.",
    isMajor: false,
  },
  '12-30': {
    name: 'Rizal Day',
    message: "Today is Rizal Day - honoring our national hero, Dr. Jose Rizal.",
    isMajor: true,
  },
  '12-31': {
    name: "New Year's Eve",
    message: "It's New Year's Eve! Time to celebrate and welcome a brand new year.",
    isMajor: true,
  },
};

/**
 * Fun/quirky national days (month-day format: "MM-DD")
 * These add variety and fun to daily briefings
 */
export const FUN_DAYS: Record<string, Holiday> = {
  '01-21': {
    name: 'National Hugging Day',
    message: "It's National Hugging Day - a perfect excuse to share a warm embrace!",
    isMajor: false,
  },
  '02-09': {
    name: 'National Pizza Day',
    message: "It's National Pizza Day! Maybe a treat for later?",
    isMajor: false,
  },
  '03-14': {
    name: 'Pi Day',
    message: "It's Pi Day (3.14)! A day for math lovers and pie lovers alike.",
    isMajor: false,
  },
  '03-20': {
    name: 'International Day of Happiness',
    message: "It's the International Day of Happiness - a reminder to find joy in little things!",
    isMajor: false,
  },
  '04-22': {
    name: 'Earth Day',
    message: "Happy Earth Day! Let's appreciate our beautiful planet.",
    isMajor: false,
  },
  '05-04': {
    name: 'Star Wars Day',
    message: "May the Fourth be with you! It's Star Wars Day.",
    isMajor: false,
  },
  '06-05': {
    name: 'World Environment Day',
    message: "It's World Environment Day - a good day to appreciate nature.",
    isMajor: false,
  },
  '07-17': {
    name: 'World Emoji Day',
    message: "It's World Emoji Day! 😊 Emojis help us express ourselves.",
    isMajor: false,
  },
  '07-30': {
    name: 'International Friendship Day',
    message: "It's International Friendship Day! A perfect day to reach out to a friend.",
    isMajor: false,
  },
  '09-13': {
    name: 'National Grandparents Day',
    message: "Happy Grandparents Day! Celebrating the wisdom and love of grandparents everywhere.",
    isMajor: false,
  },
  '10-10': {
    name: 'World Mental Health Day',
    message: "Today is World Mental Health Day - remember, it's okay to take care of your mind too.",
    isMajor: false,
  },
  '11-13': {
    name: 'World Kindness Day',
    message: "It's World Kindness Day! A small act of kindness can brighten someone's day.",
    isMajor: false,
  },
  '12-05': {
    name: 'International Volunteer Day',
    message: "Today is International Volunteer Day - celebrating those who give their time to help others.",
    isMajor: false,
  },
};

/**
 * Get today's holiday if any
 * @param date - Date to check (defaults to today)
 * @param includeFunDays - Whether to include fun/quirky days (default: true)
 */
export function getTodaysHoliday(
  date: Date = new Date(),
  includeFunDays: boolean = true
): Holiday | null {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const key = `${month}-${day}`;

  // Check fixed holidays first (they take priority)
  if (FIXED_HOLIDAYS[key]) {
    return FIXED_HOLIDAYS[key];
  }

  // Then check fun days
  if (includeFunDays && FUN_DAYS[key]) {
    return FUN_DAYS[key];
  }

  return null;
}

/**
 * Format holiday for briefing prompt
 */
export function formatHolidayForBriefing(date: Date = new Date()): string {
  const holiday = getTodaysHoliday(date);
  if (!holiday) return '';

  return `SPECIAL DAY: Today is ${holiday.name}. ${holiday.message}`;
}

