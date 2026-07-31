import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        const keepSignedIn = request.cookies.get("ku_keep_signed_in")?.value !== "0";
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, {
          ...options,
          ...(keepSignedIn ? { maxAge: 60 * 60 * 24 * 30 } : {})
        }));
      }
    }
  });
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      return NextResponse.redirect(login);
    }
  } catch (error) {
    // A temporary DNS/connection failure must not erase a valid browser session or force a logout.
    console.error("Supabase authentication connectivity check failed:", error);
    return response;
  }
  return response;
}
export const config = { matcher: ["/dashboard/:path*"] };
