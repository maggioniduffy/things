import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

/**
 * Validated public Supabase config. Safe in the browser and on the server.
 * Each variable is referenced by its literal name so Next inlines it into the client bundle.
 * The secret key is deliberately not read here.
 */
export function getSupabaseEnv(): SupabasePublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => {
      const name = String(issue.path[0]);
      const missing = issue.code === "invalid_type" || issue.code === "too_small";
      return `${name} is ${missing ? "missing or empty" : "invalid (expected a valid URL)"}`;
    });
    throw new Error(
      `Invalid Supabase environment: ${problems.join("; ")}. ` +
        "Copy .env.example to .env.local and fill it in (see README, Local setup).",
    );
  }

  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}
