import { auth } from "@/lib/auth"; // path to your auth file
import { toNextJsHandler } from "better-auth/next-js";

// Mount the Better Auth handler for GET and POST requests
export const { GET, POST } = toNextJsHandler(auth.handler);

// You might need to add options for specific HTTP methods if required by your app
// export const OPTIONS = async () => { ... }; 