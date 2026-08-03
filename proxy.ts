import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Sin variables de entorno todavía (primer arranque): dejar pasar.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca la sesión si el token expiró.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esLogin = request.nextUrl.pathname.startsWith("/login");
  if (!user && !esLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && esLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/hoy";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // api/cron, api/lead-web y api/webhooks son públicos: se protegen solos
    // (CRON_SECRET, honeypot+rate limit, firma de Meta respectivamente).
    "/((?!_next/static|_next/image|favicon.ico|api/cron|api/lead-web|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
