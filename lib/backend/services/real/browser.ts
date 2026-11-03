import type { BrowserBackendService } from "@/lib/backend/interfaces/browser";
import { createClient } from "@/lib/supabase/client";

/** Supabase email OTP: signInWithOtp emails a 6-digit code (set the "Magic Link" email template to show {{ .Token }}) */
export class RealBrowserService implements BrowserBackendService {
  async signInWithOtp({ email }: { email: string }) {
    const { error } = await createClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    return { error: error ? { message: error.message } : null };
  }

  async verifyOtp({ email, token }: { email: string; token: string }) {
    const { error } = await createClient().auth.verifyOtp({ email, token, type: "email" });
    return { error: error ? { message: error.message } : null };
  }

  async signOut() {
    const { error } = await createClient().auth.signOut();
    return { error: error ? { message: error.message } : null };
  }
}
