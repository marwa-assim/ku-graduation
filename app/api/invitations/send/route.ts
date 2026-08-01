import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {sendGraphEmail} from "@/lib/email";
import {createInvitationPng} from "@/lib/invitation-card";
import {escapeHtml,replacePlaceholders} from "@/lib/message-templates";

const schema=z.object({eventId:z.string().uuid(),personIds:z.array(z.string().uuid()).min(1).max(500)});
function gps(event:any){if(event.latitude!=null&&event.longitude!=null)return`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${event.latitude},${event.longitude}`)}`;if(event.map_url)return event.map_url;return`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address||event.venue||"")}`}
export async function POST(req:Request){
 const s=await createClient(),admin=createAdminClient();const{data:{user}}=await s.auth.getUser();if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});
 const{data:p}=await s.from("profiles").select("organization_id,role").eq("id",user.id).single();if(!p||!["admin","regcom"].includes(p.role))return NextResponse.json({error:"Forbidden"},{status:403});
 const parsed=schema.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:"Invalid request"},{status:400});
 const [{data:event},{data:people},{data:design},{data:colleges},{data:degrees},{data:programs}]=await Promise.all([
  admin.from("events").select("id,name,ceremony_date,venue,venue_address,map_url,latitude,longitude").eq("id",parsed.data.eventId).eq("organization_id",p.organization_id).single(),
  admin.from("people_directory").select("id,full_name,email,reference_number,college_id,degree_level_id,program_id").in("id",parsed.data.personIds).eq("organization_id",p.organization_id),
  admin.from("invitation_designs").select("*").eq("event_id",parsed.data.eventId).eq("organization_id",p.organization_id).eq("active",true).order("updated_at",{ascending:false}).limit(1).maybeSingle(),
  admin.from("colleges").select("id,name").eq("organization_id",p.organization_id),admin.from("degree_levels").select("id,name").eq("organization_id",p.organization_id),admin.from("academic_programs").select("id,name").eq("organization_id",p.organization_id)
 ]);
 if(!event)return NextResponse.json({error:"Event not found"},{status:404});if(!design)return NextResponse.json({error:"Save an invitation design before sending."},{status:400});
 const cm=new Map((colleges??[]).map((x:any)=>[x.id,x.name])),dm=new Map((degrees??[]).map((x:any)=>[x.id,x.name])),pm=new Map((programs??[]).map((x:any)=>[x.id,x.name]));
 const dateObj=new Date(event.ceremony_date),date=new Intl.DateTimeFormat("en-GB",{dateStyle:"long",timeZone:"Asia/Bahrain"}).format(dateObj),time=new Intl.DateTimeFormat("en-GB",{timeStyle:"short",timeZone:"Asia/Bahrain"}).format(dateObj),gpsLink=gps(event),systemLink=`${process.env.NEXT_PUBLIC_APP_URL||new URL(req.url).origin}/dashboard/tickets`;
 let sent=0,failed=0;const errors:string[]=[];
 for(const person of people??[]){if(!person.email){failed++;errors.push(`${person.full_name}: no email`);continue}try{
  const values={name:person.full_name,id:person.reference_number||"—",email:person.email,college:String(cm.get(person.college_id)||"—"),degree:String(dm.get(person.degree_level_id)||"—"),program:String(pm.get(person.program_id)||"—"),event:event.name,date,time,venue:event.venue||"—",location:event.venue_address||event.venue||"—",gps_link:gpsLink,system_link:systemLink};
  const png=await createInvitationPng(design,values);
  const subject=replacePlaceholders(design.email_subject||"Invitation to {{event}}",values);
  const bodyText=replacePlaceholders(design.email_body||"Dear {{name}},\n\nPlease find your personalized invitation attached.\n\nDate: {{date}}\nTime: {{time}}\nVenue: {{venue}}\nDirections: {{gps_link}}",values);
  const emailFont=String(design.email_font_family||"Arial").replace(/[^a-zA-Z0-9 ,"'-]/g,"");const emailSize=Math.min(32,Math.max(10,Number(design.email_font_size||16)));const emailColor=/^#[0-9A-Fa-f]{6}$/.test(String(design.email_text_color||""))?design.email_text_color:"#111827";const html=`<div style="font-family:${escapeHtml(emailFont)},sans-serif;font-size:${emailSize}px;color:${emailColor};font-weight:${design.email_bold?700:400};line-height:1.6">${escapeHtml(bodyText).replaceAll("\n","<br/>")}<p><a href="${escapeHtml(gpsLink)}">Open GPS directions</a></p></div>`;
  await sendGraphEmail({to:person.email,subject,html,attachments:[{name:`Invitation-${person.reference_number||person.id}.png`,contentType:"image/png",contentBytes:png.toString("base64")} ]});
  const now=new Date().toISOString();const up=await admin.from("invitations").upsert({organization_id:p.organization_id,event_id:event.id,person_id:person.id,recipient:person.email,status:"sent",sent_at:now},{onConflict:"event_id,person_id"});if(up.error)throw new Error(`Email sent but status update failed: ${up.error.message}`);
  const personUpdate=await admin.from("people_directory").update({invitation_status:"sent",invitation_sent_at:now}).eq("id",person.id).eq("organization_id",p.organization_id).select("id").single();if(personUpdate.error)throw new Error(`Email sent but student status update failed: ${personUpdate.error.message}`);sent++;
 }catch(e:any){failed++;errors.push(`${person.full_name}: ${e.message}`)}}
 return NextResponse.json({sent,failed,errors:errors.slice(0,10)});
}
