import { NextResponse, type NextRequest } from "next/server";
import { SITE_REALM, isPublicPath, sitePasswordMatches } from "@/lib/site-password";

/** Contraseña de sitio para staging (ver src/lib/site-password.ts). Sin SITE_PASSWORD no hace nada. */
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password || isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  if (sitePasswordMatches(request.headers.get("authorization"), password)) return NextResponse.next();
  return new NextResponse("Se necesita la contraseña de staging.", {
    status: 401,
    headers: { "www-authenticate": `Basic realm="${SITE_REALM}", charset="UTF-8"` },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
