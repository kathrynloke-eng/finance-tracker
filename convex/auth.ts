import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

// Password credentials are hashed by Convex Auth. Google OAuth can be added
// once production Google credentials and redirect URLs are configured.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
