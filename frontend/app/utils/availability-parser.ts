import * as chrono from 'chrono-node';

export interface TimeSlot {
  start: string; // HH:mm
  end: string;   // HH:mm
}

export interface AvailabilityData {
  [date: string]: TimeSlot[];
}

/**
 * Get current time in Bangkok for reference
 */
const getBangkokNow = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
};

/**
 * Parses free text (e.g., "Friday 6pm-9pm") into a structured availability object.
 * 
 * @param text The natural language text to parse
 * @param referenceDate Optional reference date (defaults to Bangkok now)
 * @returns An object keyed by YYYY-MM-DD containing time slots
 */
export const parseAvailabilityText = (text: string, referenceDate?: Date): AvailabilityData => {
  const ref = referenceDate || getBangkokNow();
  const results = chrono.parse(text, ref);
  const availability: AvailabilityData = {};

  results.forEach(result => {
    const startDate = result.start.date();
    const endDate = result.end ? result.end.date() : new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // Default to 2 hours

    const dateKey = formatDate(startDate);
    const startStr = formatTime(startDate);
    const endStr = formatTime(endDate);

    if (!availability[dateKey]) {
      availability[dateKey] = [];
    }

    // Add slot if it doesn't already exist or overlap (simple version)
    availability[dateKey].push({ start: startStr, end: endStr });
  });

  return availability;
};

/**
 * Helper to format Date to YYYY-MM-DD in Bangkok Time
 */
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

/**
 * Helper to format Date to HH:mm in Bangkok Time
 */
const formatTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
};

