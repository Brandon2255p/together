export interface AuthError {
  message: string;
}

/**
 * In the browser: sign-in with Supabase email OTP (a 6-digit code, no passwords), and live changes.
 */
export interface BrowserBackendService {
  /** emails a 6-digit code; creates the account on first sign-in */
  signInWithOtp(params: { email: string }): Promise<{ error: AuthError | null }>;
  verifyOtp(params: { email: string; token: string }): Promise<{ error: AuthError | null }>;
  signOut(): Promise<{ error: AuthError | null }>;
  /**
   * Calls `onChange` whenever something in your Together changes (yours or the other person's edits), as far as
   * row-level security lets you see it. Returns the function that stops listening.
   */
  watchTogether(onChange: () => void): () => void;
}
