import { convexAuthNextjsMiddleware, createRouteMatcher, nextjsMiddlewareRedirect } from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (!isPublicRoute(request)) {
    if (!(await convexAuth.isAuthenticated())) return nextjsMiddlewareRedirect(request, "/sign-in");
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
