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

// Where to go after signing in, when someone arrived through a join link (/join/CODE). Only join links are allowed,
// so this can't be used to send people elsewhere.
const NEXT_KEY = "together.sign-in-next";
const SAFE_NEXT = /^\/join\/[A-Za-z0-9-]{1,12}$/;

export function rememberNext(next: string | null) {
  try {
    if (next && SAFE_NEXT.test(next)) sessionStorage.setItem(NEXT_KEY, next);
    else sessionStorage.removeItem(NEXT_KEY);
  } catch {
    // private mode: they land on Home instead
  }
}

export function recallNext(): string | null {
  try {
    const next = sessionStorage.getItem(NEXT_KEY);
    return next && SAFE_NEXT.test(next) ? next : null;
  } catch {
    return null;
  }
}
