import type { BrowserBackendService } from "@/lib/backend/interfaces/browser";
import { postUpload } from "@/lib/files/client/post-upload";
import type { UploadTarget } from "@/lib/models";

const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms));

/** Stub sign-in: any email gets a "code"; any 6 digits verify except 000000 (to check the error state). */
export class StubBrowserService implements BrowserBackendService {
  async signInWithOtp({ email }: { email: string }) {
    await wait();
    console.info("[stub] signInWithOtp", email, "— any 6-digit code works (000000 fails)");
    return { error: null };
  }

  async verifyOtp({ token }: { email: string; token: string }) {
    await wait();
    console.info("[stub] verifyOtp", token);
    return token === "000000" ? { error: { message: "That code didn't match. Try again or resend it." } } : { error: null };
  }

  async signOut() {
    await wait(100);
    return { error: null };
  }

  /** the stub's data lives on the dev server, so there's nothing to listen to: changes show after a refresh */
  watchTogether() {
    console.info("[stub] watchTogether: no live changes on the stub");
    return () => undefined;
  }

  /** the stub's bucket lives on the dev server: /api/stub/storage keeps the encrypted bytes in memory */
  /** the stub's signed uploads POST to /api/stub/storage, the same way the browser POSTs to S3 */
  uploadFileObject({ target, body }: { target: UploadTarget; body: Blob }) {
    return postUpload(target, body);
  }
}
