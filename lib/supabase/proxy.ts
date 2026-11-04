import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, serverSupabaseUrl, supabasePublishableKey } from "./config";

const PUBLIC_PATHS = ["/sign-in", "/verify", "/design-system", "/api/health"];

/** Refreshes the Supabase session cookie and sends signed-out visitors to /sign-in */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    serverSupabaseUrl(),
    supabasePublishableKey(),
    {
      cookieOptions: { name: AUTH_COOKIE_NAME },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    // a join link comes back to itself after signing in
    if (request.nextUrl.pathname.startsWith("/join/")) url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return response;
}
