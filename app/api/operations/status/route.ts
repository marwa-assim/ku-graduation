import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {requireProfile} from "@/lib/auth";

const schema=z.object({
  table:z.enum(["people_directory","fittings","photo_sessions","vip_assignments","event_services"]),
  id:z.string().uuid(),
  field:z.string().min(1).max(64),
  value:z.string().min(1).max(64)
});

const allowed:Record<string,Record<string,string[]>>={
  people_directory:{registration_status:["pending","registered","cancelled"],payment_status:["pending","paid","waived","refunded"]},
  fittings:{status:["pending","fitted"],collected_status:["pending","collected","returned"]},
  photo_sessions:{status:["pending","scheduled","photographed","delivered"]},
  vip_assignments:{arrival_status:["pending","arrived"],seating_status:["pending","seated"]},
  event_services:{status:["planned","confirmed","cancelled"]}
};

const roleAccess:Record<string,string[]>={
  people_directory:["admin","regcom","finance","scanner","land","vip"],
  fittings:["admin","regcom","tailor"],
  photo_sessions:["admin","regcom","photographer"],
  vip_assignments:["admin","vip"],
  event_services:["admin"]
};

export async function PATCH(request:Request){
  const body=schema.safeParse(await request.json().catch(()=>null));
  if(!body.success)return NextResponse.json({error:"Invalid status update."},{status:400});
  const {table,id,field,value}=body.data;
  if(!allowed[table]?.[field]?.includes(value))return NextResponse.json({error:"Unsupported status value."},{status:400});
  const p=await requireProfile(roleAccess[table] as any);
  const supabase=await createClient();
  const payload:Record<string,unknown>={[field]:value,updated_at:new Date().toISOString()};
  const {data,error}=await supabase.from(table).update(payload).eq("id",id).eq("organization_id",p.organization_id).select(`id,${field}`).single();
  if(error||!data)return NextResponse.json({error:error?.message||"The status was not updated."},{status:409});
  return NextResponse.json({ok:true,id,field,value:(data as any)[field]},{headers:{"cache-control":"no-store"}});
}
