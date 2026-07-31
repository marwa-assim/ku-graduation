"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function login(formData: FormData) {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) redirect("/login?error=invalid");

  const supabase = await createClient();
  let error: Error | null = null;
  try {
    const result = await supabase.auth.signInWithPassword(parsed.data as {email:string;password:string});
    error = result.error;
  } catch {
    redirect("/login?error=service_unavailable");
  }
  if (error) redirect("/login?error=credentials");
  const cookieStore = await cookies();
  const keepSignedIn = formData.get("keep_signed_in") === "on";
  cookieStore.set("ku_keep_signed_in", keepSignedIn ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: keepSignedIn ? 60 * 60 * 24 * 30 : undefined
  });
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
