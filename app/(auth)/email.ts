"use client";

// The email being verified travels from /sign-in to /verify in sessionStorage (kept out of the URL).
const KEY = "together.sign-in-email";

export function rememberEmail(email: string) {
  try {
    sessionStorage.setItem(KEY, email);
  } catch {
    // private mode: /verify will ask them to start again
  }
}

export function recallEmail(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
