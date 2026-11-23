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

  /** Supabase Realtime: every table in the supabase_realtime publication (supabase/schemas/realtime.sql) */
  watchTogether(onChange: () => void) {
    const sb = createClient();
    // row-level security on realtime needs the signed-in person's token
    void sb.realtime.setAuth();
    const channel = sb
      .channel(`together-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public" }, () => onChange())
      .subscribe();
    return () => void sb.removeChannel(channel);
  }

  /** a signed upload into the private "files" bucket; the bytes go straight to Storage, not through Vercel */
  async uploadFileObject({ path, token, body }: { path: string; token: string; body: Blob }) {
    const { error } = await createClient().storage.from("files").uploadToSignedUrl(path, token, body, { contentType: "application/octet-stream" });
    return { error: error ? { message: error.message } : null };
  }
}
