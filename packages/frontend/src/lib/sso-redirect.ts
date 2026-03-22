/**
 * SSO redirect utilities.
 *
 * When a product (Nexum/SafeSpec) redirects to OpShield for login,
 * it passes a `?redirect=<callback_url>` query parameter. After the user
 * authenticates (login + 2FA), we need to redirect them back to the product
 * via the backend SSO endpoint which issues a JWT.
 *
 * This module provides helpers for:
 * - Detecting whether a redirect target is an external product callback
 * - Building the correct post-auth navigation URL
 * - Storing/retrieving the redirect target across the 2FA flow
 */

const SESSION_STORAGE_KEY = "auth_redirect";

/**
 * Check if a URL is an external product callback (starts with http/https).
 * Internal paths like "/admin" return false.
 */
export function isExternalRedirect(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * Build the URL to navigate to after authentication completes.
 *
 * For external product callbacks: routes through the backend SSO endpoint
 * which validates the callback, generates a JWT, and redirects to the product.
 *
 * For internal paths: returns the path directly (e.g., "/admin").
 */
export function buildPostAuthUrl(redirectTarget: string): string {
  if (isExternalRedirect(redirectTarget)) {
    return `/api/auth/sso-redirect?callback=${encodeURIComponent(redirectTarget)}`;
  }
  return redirectTarget;
}

/**
 * Store the redirect target in sessionStorage so it survives
 * the 2FA page navigation (window.location.href loses React Router state).
 */
export function storeRedirectTarget(target: string): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, target);
}

/**
 * Retrieve and clear the stored redirect target.
 * Returns the stored value or null if none exists.
 */
export function consumeRedirectTarget(): string | null {
  const target = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (target) {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
  return target;
}

/**
 * Retrieve the stored redirect target without clearing it.
 * Use this when you need to read but may not navigate yet (e.g., 2FA page load).
 */
export function peekRedirectTarget(): string | null {
  return sessionStorage.getItem(SESSION_STORAGE_KEY);
}
