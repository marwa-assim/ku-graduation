import {NextResponse} from "next/server";
import {z} from "zod";
import {requireProfile} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {sendGraphEmail} from "@/lib/email";
import {GET as createTicketImageResponse} from "../image/route";

const schema=z.object({ticketId:z.string().uuid(),personId:z.string().uuid()});
const esc=(v:any)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const kind=(v?:string)=>v==="graduate"?"Graduate Seat":v==="staff"?"Academic Staff Seat":v==="free_guest"?"Free Guest Ticket":v==="paid_guest"?"Paid Guest Ticket":"Event Ticket";
const fmt=(v?:string)=>v?new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bahrain"}).format(new Date(v)):"—";

export async function POST(req:Request){
 try{
  const profile=await requireProfile();const body=schema.parse(await req.json());const admin=createAdminClient();
  const[{data:person,error:pe},{data:ticket,error:te}]=await Promise.all([
   admin.from("people_directory").select("id,full_name,email,reference_number,organization_id").eq("id",body.personId).single(),
   admin.from("tickets").select("id,organization_id,seat:seats(code,label,seat_type),event:events(name,ceremony_date,venue,venue_address)").eq("id",body.ticketId).single()
  ]);
  if(pe||te||!person||!ticket)throw new Error(pe?.message||te?.message||"Ticket not found");
  if(person.organization_id!==profile.organization_id||ticket.organization_id!==profile.organization_id)return NextResponse.json({error:"Forbidden"},{status:403});
  if(!person.email)return NextResponse.json({error:"Recipient email is missing"},{status:400});
  const seat:any=Array.isArray(ticket.seat)?ticket.seat[0]:ticket.seat,event:any=Array.isArray(ticket.event)?ticket.event[0]:ticket.event;
  const title=kind(seat?.seat_type),seatNo=seat?.label||seat?.code||"Unassigned";
  const imageUrl=new URL(`/api/tickets/image?ticketId=${encodeURIComponent(body.ticketId)}&personId=${encodeURIComponent(body.personId)}`,req.url);
  const imageRequest=new Request(imageUrl,{headers:{cookie:req.headers.get("cookie")||""}});
  const imageResponse=await createTicketImageResponse(imageRequest);
  if(!imageResponse.ok){const raw=await imageResponse.text();let detail:any=null;try{detail=raw?JSON.parse(raw):null}catch{}throw new Error(detail?.error||raw||"Could not create the ticket image");}
  const png=Buffer.from(await imageResponse.arrayBuffer());
  const html=`<p>Dear ${esc(person.full_name)},</p><p>Your complete <strong>${esc(title)}</strong> is attached as a PNG image.</p><p><strong>ID:</strong> ${esc(person.reference_number||"—")}<br/><strong>Seat:</strong> ${esc(seatNo)}<br/><strong>Date and time:</strong> ${esc(fmt(event?.ceremony_date))}<br/><strong>Venue:</strong> ${esc(event?.venue||event?.venue_address||"—")}</p><p>The QR code is valid for one successful entry scan only.</p>`;
  const {data:adminProfiles}=await admin.from("profiles").select("email").eq("organization_id",profile.organization_id).eq("role","admin");
  const adminCc=[process.env.ADMIN_CC_EMAIL,process.env.MS_SENDER_EMAIL,...(adminProfiles||[]).map((x:any)=>x.email)].filter(Boolean).filter((v:any,i:number,a:any[])=>a.indexOf(v)===i) as string[];
  await sendGraphEmail({to:person.email,cc:adminCc.length?adminCc:undefined,subject:`${title} — ${event?.name||"Graduation Ceremony"}`,html,attachments:[{name:`${person.reference_number||person.id}-${seat?.seat_type||"ticket"}-${seatNo}.png`,contentType:"image/png",contentBytes:png.toString("base64")} ]});
  return NextResponse.json({ok:true,recipient:person.email,cc:adminCc});
 }catch(e:any){return NextResponse.json({error:e?.message||"Unable to send ticket"},{status:400})}
}
