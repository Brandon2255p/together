export interface AuthError {
  message: string;
}

/**
 * Sign-in in the browser: Supabase email OTP (a 6-digit code, no passwords). Used by the auth view-models only.
 */
export interface BrowserBackendService {
  /** emails a 6-digit code; creates the account on first sign-in */
  signInWithOtp(params: { email: string }): Promise<{ error: AuthError | null }>;
  verifyOtp(params: { email: string; token: string }): Promise<{ error: AuthError | null }>;
  signOut(): Promise<{ error: AuthError | null }>;
}
