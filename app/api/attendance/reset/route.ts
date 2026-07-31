import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {requireProfile} from "@/lib/auth";

const schema=z.object({personId:z.string().uuid(),reason:z.string().trim().max(240).optional()});

export async function POST(request:Request){
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid attendance reset request."},{status:400});
 await requireProfile(["admin","regcom"]);
 const s=await createClient();
 const {data,error}=await s.rpc("reset_person_attendance",{p_person_id:parsed.data.personId,p_reason:parsed.data.reason||"Reset by administrator"});
 if(error)return NextResponse.json({error:error.message},{status:409});
 return NextResponse.json({ok:true,...(data&&typeof data==="object"?data:{})},{headers:{"cache-control":"no-store"}});
}
