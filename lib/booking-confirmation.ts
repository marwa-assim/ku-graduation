import QRCode from "qrcode";
import {createAdminClient} from "@/lib/supabase/admin";
import {sendGraphEmail,EmailAttachment} from "@/lib/email";
import {escapeHtml} from "@/lib/message-templates";
import {encodeTicketQr} from "@/lib/ticket-payload";

function directions(event:any){if(event.latitude!=null&&event.longitude!=null)return`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${event.latitude},${event.longitude}`)}`;if(event.map_url)return event.map_url;return`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address||event.venue||"")}`}
const ticketType=(value?:string)=>value==="graduate"?"Graduate":value==="staff"?"Academic Staff":value==="free_guest"?"Free Guest":value==="paid_guest"?"Paid Guest":"Event Ticket";
export async function sendBookingConfirmation(bookingId:string){
 const admin=createAdminClient();const{data:booking,error}=await admin.from("bookings").select("id,event_id,user_id,person_id,status,total_bhd").eq("id",bookingId).single();if(error||!booking)throw new Error(error?.message||"Booking not found");
 const[{data:event},{data:tickets}]=await Promise.all([admin.from("events").select("id,name,ceremony_date,venue,venue_address,map_url,latitude,longitude").eq("id",booking.event_id).single(),admin.from("tickets").select("id,qr_token,seat_id,status").eq("booking_id",booking.id).order("created_at")]);if(!event)throw new Error("Event not found");
 let person:any=null;if(booking.person_id){const q=await admin.from("people_directory").select("id,full_name,email,reference_number,person_type").eq("id",booking.person_id).maybeSingle();person=q.data}else if(booking.user_id){const q=await admin.from("people_directory").select("id,full_name,email,reference_number,person_type").eq("profile_id",booking.user_id).maybeSingle();person=q.data;if(!person){const p=await admin.from("profiles").select("id,full_name,email,reference_number").eq("id",booking.user_id).maybeSingle();person=p.data}}
 if(!person?.email)return{sent:false,reason:"No email address"};
 const seatIds=(tickets??[]).map((x:any)=>x.seat_id),{data:seats}=seatIds.length?await admin.from("seats").select("id,code,label,seat_type,section").in("id",seatIds):{data:[] as any[]};const sm=new Map((seats??[]).map((x:any)=>[x.id,x]));
 const appUrl=process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000",ticketUrl=`${appUrl}/dashboard/tickets`,gps=directions(event),d=new Date(event.ceremony_date),date=new Intl.DateTimeFormat("en-GB",{dateStyle:"long",timeZone:"Asia/Bahrain"}).format(d),time=new Intl.DateTimeFormat("en-GB",{timeStyle:"short",timeZone:"Asia/Bahrain"}).format(d);
 const attachments:EmailAttachment[]=[];const rows:string[]=[];
 for(let i=0;i<(tickets??[]).length;i++){
  const t:any=(tickets??[])[i],seat:any=sm.get(t.seat_id),cid=`ticket-${t.id}`;
  const qrValue=encodeTicketQr({token:String(t.qr_token||"")});
  const qr=await QRCode.toBuffer(qrValue,{type:"png",width:420,margin:6,errorCorrectionLevel:"H",color:{dark:"#101724",light:"#ffffff"}});
  attachments.push({name:`QR-${seat?.label||seat?.code||i+1}.png`,contentType:"image/png",contentBytes:qr.toString("base64"),isInline:true,contentId:cid});
  rows.push(`<tr><td style="padding:12px;border:1px solid #ddd">${escapeHtml(ticketType(seat?.seat_type))}</td><td style="padding:12px;border:1px solid #ddd"><strong>${escapeHtml(seat?.label||seat?.code||"—")}</strong></td><td style="padding:12px;border:1px solid #ddd;text-align:center"><img src="cid:${cid}" width="180" height="180" alt="Scannable ticket QR code" style="display:block;margin:auto;background:#fff;padding:8px"/></td></tr>`)
 }
 const html=`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222"><h2>Booking confirmed — ${escapeHtml(event.name)}</h2><p>Dear ${escapeHtml(person.full_name)},</p><p>Your event booking and ticket issuance are confirmed.</p><table style="border-collapse:collapse"><tr><td><b>Student/Staff ID</b></td><td>${escapeHtml(person.reference_number||"—")}</td></tr><tr><td><b>Date</b></td><td>${escapeHtml(date)}</td></tr><tr><td><b>Time</b></td><td>${escapeHtml(time)}</td></tr><tr><td><b>Venue</b></td><td>${escapeHtml(event.venue||"—")}</td></tr><tr><td><b>Total paid</b></td><td>BHD ${Number(booking.total_bhd||0).toFixed(3)}</td></tr></table><p><a href="${escapeHtml(gps)}">Open GPS navigation</a> · <a href="${escapeHtml(ticketUrl)}">Log in to view full tickets</a></p><h3>Your tickets</h3><table style="border-collapse:collapse"><thead><tr><th style="padding:12px;border:1px solid #ddd">Type</th><th style="padding:12px;border:1px solid #ddd">Seat</th><th style="padding:12px;border:1px solid #ddd">QR</th></tr></thead><tbody>${rows.join("")}</tbody></table><p>Present the full QR code at the entrance. Each ticket is valid for one successful scan.</p></div>`;
 await sendGraphEmail({to:person.email,subject:`Booking confirmed — ${event.name}`,html,attachments});
 await admin.from("bookings").update({confirmation_email_sent_at:new Date().toISOString()}).eq("id",booking.id);
 return{sent:true};
}
