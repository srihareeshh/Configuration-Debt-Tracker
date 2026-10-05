/**
 * Legacy authentication routing logic
 */

export function handleUserLogin(userToken: string): boolean {
  // Temporary migration flag - scheduled for removal once OAuth migration completes
  if (process.env.FEATURE_LEGACY_LOGIN === 'true') {
    console.warn('DEPRECATED: Executing legacy password login path.');
    return userToken.length > 0;
  }
  return true;
}
