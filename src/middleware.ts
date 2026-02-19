import { NextRequest, NextResponse } from "next/server";

const AUTH_USER = process.env.AUTH_USER || "kyrill";
const AUTH_PASS = process.env.AUTH_PASSWORD || "";

export function middleware(request: NextRequest) {
  if (!AUTH_PASS) {
    // No password set — skip auth
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization");

  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(":");
      if (user === AUTH_USER && pass === AUTH_PASS) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="ClawCRM"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
