/**
 * API configuration and utility functions
 */

/**
 * API base URL from environment variable or default
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

/**
 * API secret key from environment variable
 */
export const API_SECRET_KEY = process.env.NEXT_PUBLIC_X_API_KEY || ''

/**
 * Converts a relative image URL to an absolute URL
 * @param imageUrl - The image URL (can be relative or absolute)
 * @returns Absolute URL for the image
 */
export function getImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) {
    return '/image/icon/icon_account.svg' // Default fallback image
  }

  // If already an absolute URL (starts with http:// or https://), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }

  // Remove trailing slash from API_BASE_URL if present
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL

  // /uploads/ 경로는 Admin 서버에서 제공되므로 API_BASE_URL을 붙임
  if (imageUrl.startsWith('/uploads/')) {
    return `${baseUrl}${imageUrl}`
  }

  // If starts with /, it's already a root-relative path for Web static files
  if (imageUrl.startsWith('/')) {
    return imageUrl
  }

  // Otherwise, prepend API_BASE_URL for relative paths
  const path = `/${imageUrl}`

  return `${baseUrl}${path}`
}

/**
 * Gets authorization headers for API requests
 * @param token - Optional access token (if not provided, will try to get from session)
 * @returns Headers object with Content-Type and optional Authorization and X-API-KEY
 */
export function getAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Add API secret key if available
  if (API_SECRET_KEY) {
    headers['X-API-KEY'] = API_SECRET_KEY
  }

  // Add authorization token if provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

