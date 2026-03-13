/**
 * API configuration and utility functions
 */

export const API_BASE_URL =
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ''

export const API_SECRET_KEY = process.env.NEXT_PUBLIC_X_API_KEY || ''

/**
 * Converts a relative image/file URL to an absolute URL
 */
export function getImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) return ''

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }

  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL

  if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('/static/')) {
    return `${baseUrl}${imageUrl}`
  }

  if (imageUrl.startsWith('/')) {
    return imageUrl
  }

  return `${baseUrl}/${imageUrl}`
}

/**
 * Gets authorization headers for API requests
 */
export function getAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (API_SECRET_KEY) {
    headers['X-API-KEY'] = API_SECRET_KEY
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}
