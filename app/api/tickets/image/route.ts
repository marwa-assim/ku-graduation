import {NextResponse} from "next/server";
import QRCode from "qrcode";
import sharp from "sharp";
import {requireProfile} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {encodeTicketQr} from "@/lib/ticket-payload";

const esc=(v:any)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const kind=(v?:string)=>v==="graduate"?"Graduate Seat":v==="staff"?"Academic Staff Seat":v==="free_guest"?"Free Guest Ticket":v==="paid_guest"?"Paid Guest Ticket":"Event Ticket";
const fmt=(v?:string)=>v?new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bahrain"}).format(new Date(v)):"—";

export async function GET(req:Request){
 try{
  const profile=await requireProfile();const url=new URL(req.url);const ticketId=url.searchParams.get("ticketId");const personId=url.searchParams.get("personId");
  if(!ticketId||!personId)return NextResponse.json({error:"Ticket and person are required"},{status:400});
  const admin=createAdminClient();const[{data:person,error:pe},{data:ticket,error:te},{data:org}]=await Promise.all([
   admin.from("people_directory").select("id,full_name,email,reference_number,photo_url,organization_id,person_type").eq("id",personId).single(),
   admin.from("tickets").select("id,qr_token,organization_id,person_id,user_id,seat:seats(code,label,seat_type),event:events(name,ceremony_date,end_date,venue,venue_address,map_url)").eq("id",ticketId).single(),
   admin.from("organizations").select("name,logo_url").eq("id",profile.organization_id).maybeSingle()
  ]);
  if(pe||te||!person||!ticket)throw new Error(pe?.message||te?.message||"Ticket not found");
  if(person.organization_id!==profile.organization_id||ticket.organization_id!==profile.organization_id)return NextResponse.json({error:"Forbidden"},{status:403});
  const seat:any=Array.isArray(ticket.seat)?ticket.seat[0]:ticket.seat,event:any=Array.isArray(ticket.event)?ticket.event[0]:ticket.event;
  const title=kind(seat?.seat_type),seatNo=seat?.label||seat?.code||"Unassigned";
  const qrValue=encodeTicketQr({token:ticket.qr_token});
  const qr=await QRCode.toBuffer(qrValue,{type:"png",width:512,margin:8,errorCorrectionLevel:"M",color:{dark:"#101724",light:"#ffffff"}});
  const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1540"><rect width="900" height="1540" rx="40" fill="#fffdf8"/><rect x="18" y="18" width="864" height="1504" rx="34" fill="none" stroke="#d4a843" stroke-width="6"/><rect x="42" y="42" width="816" height="170" rx="24" fill="#101724"/><text x="450" y="92" text-anchor="middle" fill="#d4a843" font-family="Arial" font-size="32" font-weight="700">${esc((org as any)?.name||"KINGDOM UNIVERSITY")}</text><text x="450" y="154" text-anchor="middle" fill="white" font-family="Arial" font-size="28">${esc(event?.name||"GRADUATION CEREMONY")}</text><circle cx="450" cy="300" r="74" fill="#eef2f7"/><text x="450" y="316" text-anchor="middle" fill="#101724" font-family="Arial" font-size="38" font-weight="700">${esc(String(person.full_name||"G").split(/\s+/).slice(0,2).map((x:string)=>x[0]).join("").toUpperCase())}</text><text x="450" y="420" text-anchor="middle" fill="#111827" font-family="Arial" font-size="46" font-weight="700">${esc(person.full_name)}</text><text x="450" y="470" text-anchor="middle" fill="#475569" font-family="Arial" font-size="28">ID: ${esc(person.reference_number||"—")}</text><rect x="210" y="515" width="480" height="74" rx="20" fill="#efe3bd"/><text x="450" y="562" text-anchor="middle" fill="#101724" font-family="Arial" font-size="31" font-weight="700">${esc(title.toUpperCase())}</text><text x="100" y="675" fill="#64748b" font-family="Arial" font-size="24">SEAT NUMBER</text><text x="100" y="735" fill="#101724" font-family="Arial" font-size="50" font-weight="700">${esc(seatNo)}</text><text x="100" y="820" fill="#64748b" font-family="Arial" font-size="24">DATE &amp; TIME</text><text x="100" y="865" fill="#101724" font-family="Arial" font-size="28">${esc(fmt(event?.ceremony_date))}</text><text x="100" y="930" fill="#64748b" font-family="Arial" font-size="24">VENUE</text><text x="100" y="975" fill="#101724" font-family="Arial" font-size="28">${esc(event?.venue||event?.venue_address||"Kingdom University")}</text><rect x="220" y="1015" width="460" height="460" rx="20" fill="#ffffff" stroke="#d4a843" stroke-width="3"/><line x1="100" y1="1490" x2="800" y2="1490" stroke="#e5e7eb" stroke-width="2"/><text x="450" y="1518" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="19">Present this ticket at the entrance · QR valid for one successful scan</text></svg>`);
  const qrSized=await sharp(qr).resize(400,400,{fit:"contain",background:"#ffffff"}).png().toBuffer();
  const composites:any[]=[{input:qrSized,left:250,top:1045}];
  if(person.photo_url){try{const response=await fetch(person.photo_url);if(response.ok){const photo=Buffer.from(await response.arrayBuffer());const portrait=await sharp(photo).resize(148,148,{fit:"cover"}).composite([{input:Buffer.from(`<svg width="148" height="148"><circle cx="74" cy="74" r="74" fill="white"/></svg>`),blend:"dest-in"}]).png().toBuffer();composites.push({input:portrait,left:376,top:226})}}catch{}}
  const png=await sharp(svg).composite(composites).png().toBuffer();
  return new NextResponse(new Uint8Array(png),{headers:{"content-type":"image/png","cache-control":"private, no-store","content-disposition":`inline; filename="${String(person.reference_number||person.id).replace(/[^a-z0-9_-]/gi,"-")}-${String(seat?.seat_type||"ticket")}.png"`}});
 }catch(e:any){return NextResponse.json({error:e?.message||"Unable to create ticket image"},{status:400})}
}
