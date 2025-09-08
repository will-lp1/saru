import { createAuthClient } from "better-auth/react";
import { stripeClient } from "@better-auth/stripe/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://trysaru.com",
  plugins: [
    stripeClient({
        subscription: true
    }),
  ],
});

export type ClientSession = typeof authClient.$Infer.Session;
export type ClientUser = ClientSession["user"];

