/**
 * Date formatting utilities
 */

/**
 * Formats a Date object to a string in YYYY-MM-DD format
 * @param date - The Date object to format
 * @returns Formatted date string (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formats a Date object to separate date and time strings
 * @param date - The Date object to format
 * @returns Object with dateStr (YYYY-MM-DD) and timeStr (HH:MM:SS)
 */
export function formatDateTime(date: Date): { dateStr: string; timeStr: string } {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hours}:${minutes}:${seconds}`,
  }
}

