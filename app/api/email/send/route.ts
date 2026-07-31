import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendGraphEmail } from "@/lib/email";

const schema = z.object({
  to:z.string().email(),
  subject:z.string().min(3).max(180),
  html:z.string().min(1).max(100000)
});

export async function POST(request:Request) {
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) return NextResponse.json({error:"Unauthenticated."},{status:401});

  const {data:profile} = await supabase.from("profiles").select("role").eq("id",user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({error:"Forbidden."},{status:403});

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({error:"Invalid email payload."},{status:400});
  try {
    await sendGraphEmail(parsed.data as {to:string;subject:string;html:string});
    return NextResponse.json({ok:true});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error ? error.message : "Email failed."},{status:502});
  }
}
