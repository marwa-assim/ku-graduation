import {requireProfile} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {OperationalAnalytics,AnalyticsDimension} from "@/components/OperationalAnalytics";
import {RoleOperationsOverview,OperationGroup,OperationMetric} from "@/components/RoleOperationsOverview";
import {Download} from "lucide-react";
import {RealtimeRefresh} from "@/components/RealtimeRefresh";
import {buildAttendance} from "@/lib/attendance";

function group(rows:any[],key:string):AnalyticsDimension[]{
 const m=new Map<string,AnalyticsDimension>();
 for(const r of rows){
  const name=r[key]||"Unassigned";
  const x=m.get(name)||{name,registered:0,paid:0,fitted:0,collected:0,photographed:0,invited:0,booked:0};
  for(const k of ["registered","paid","fitted","collected","photographed","invited","booked"] as const)if(r[k])x[k]++;
  m.set(name,x);
 }
 return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function metric(key:string,label:string,value:number,total:number):OperationMetric{return{key,label,value,total}}

export default async function Page(){
 const p=await requireProfile(["admin","regcom","finance","land","vip","scanner"]);
 const s=await createClient();
 const{data:event}=await s.from("events").select("id").eq("organization_id",p.organization_id).order("ceremony_date",{ascending:false}).limit(1).maybeSingle();
 const eid=event?.id;
 const[people,cols,degs,progs,fits,photos,invs,tickets,seats,vips,scans]=await Promise.all([
  s.from("people_directory").select("id,profile_id,person_type,registration_status,payment_status,invitation_status,college_id,degree_level_id,program_id,arrival_status,role").eq("organization_id",p.organization_id),
  s.from("colleges").select("id,name").eq("organization_id",p.organization_id),
  s.from("degree_levels").select("id,name").eq("organization_id",p.organization_id),
  s.from("academic_programs").select("id,name").eq("organization_id",p.organization_id),
  s.from("fittings").select("person_id,status,collected_status").eq("organization_id",p.organization_id),
  s.from("photo_sessions").select("person_id,status").eq("organization_id",p.organization_id),
  s.from("invitations").select("person_id,status").eq("organization_id",p.organization_id).match(eid?{event_id:eid}:{}),
  s.from("tickets").select("person_id,user_id,seat_id").eq("organization_id",p.organization_id).match(eid?{event_id:eid}:{}),
  s.from("seats").select("id,seat_type").eq("organization_id",p.organization_id).match(eid?{event_id:eid}:{}),
  s.from("vip_assignments").select("person_id,seat_id,arrival_status").eq("organization_id",p.organization_id).match(eid?{event_id:eid}:{}),
  s.from("entry_scans").select("ticket_id,scanned_at,result").eq("organization_id",p.organization_id).eq("result","accepted")
 ]);
 const cm=new Map((cols.data??[]).map((x:any)=>[x.id,x.name]));
 const dm=new Map((degs.data??[]).map((x:any)=>[x.id,x.name]));
 const pm=new Map((progs.data??[]).map((x:any)=>[x.id,x.name]));
 const fm=new Map((fits.data??[]).map((x:any)=>[x.person_id,x]));
 const phm=new Map((photos.data??[]).map((x:any)=>[x.person_id,x]));
 const im=new Map((invs.data??[]).map((x:any)=>[x.person_id,x]));
 const sm=new Map<string,any>((seats.data??[]).map((x:any)=>[String(x.id),x]));
 const attendance=buildAttendance((tickets.data??[]) as any[],(seats.data??[]) as any[],(scans.data??[]) as any[]);
 const tby=new Map<string,any[]>();
 for(const t of tickets.data??[]){for(const k of [t.person_id,t.user_id].filter(Boolean)){const a=tby.get(k)||[];a.push(t);tby.set(k,a)}}
 const all=(people.data??[]).map((x:any)=>{
  const ts=[...(tby.get(x.id)||[]),...(x.profile_id?tby.get(x.profile_id)||[]:[])];
  const entry=attendance.personEntryByKey.get(String(x.id))||(x.profile_id?attendance.personEntryByKey.get(String(x.profile_id)):undefined);
  return {...x,college:cm.get(x.college_id)||"Unassigned",degree:dm.get(x.degree_level_id)||"Unassigned",program:pm.get(x.program_id)||"Unassigned",registered:x.registration_status==="registered",paid:x.payment_status==="paid",fitted:(fm.get(x.id)as any)?.status==="fitted",collected:(fm.get(x.id)as any)?.collected_status==="collected",photographed:["photographed","delivered"].includes((phm.get(x.id)as any)?.status),invited:(im.get(x.id)as any)?.status==="sent"||x.invitation_status==="sent",booked:ts.some((t:any)=>["graduate","staff"].includes(sm.get(t.seat_id)?.seat_type)),entered:Boolean(entry),arrived_at:entry?.scannedAt||null};
 });
 const students=all.filter((x:any)=>x.person_type==="student");
 const staff=all.filter((x:any)=>x.person_type==="academic_staff"&&(!x.role||x.role==="academic_staff"));
 const vip:any[]=[...new Map<string,any>(all.filter((x:any)=>x.person_type==="vip").map((x:any)=>[String(x.id),x])).values()];
 const studentTotal=students.length,staffTotal=staff.length,vipTotal=vip.length;
 const studentMetrics=[
  metric("total","Total students",studentTotal,studentTotal),
  metric("registered","Registered",students.filter((x:any)=>x.registered).length,studentTotal),
  metric("paid","Paid",students.filter((x:any)=>x.paid).length,studentTotal),
  metric("assigned","Graduate seats assigned",students.filter((x:any)=>x.booked).length,studentTotal),
  metric("entered","Entered",students.filter((x:any)=>x.entered).length,studentTotal),
  metric("fitted","Fitted",students.filter((x:any)=>x.fitted).length,studentTotal),
  metric("collected","Collected",students.filter((x:any)=>x.collected).length,studentTotal),
  metric("photographed","Photographed",students.filter((x:any)=>x.photographed).length,studentTotal),
  metric("invited","Invitations sent",students.filter((x:any)=>x.invited).length,studentTotal),
 ];
 const staffMetrics=[
  metric("total","Total academic staff",staffTotal,staffTotal),
  metric("assigned","Staff seats assigned",staff.filter((x:any)=>x.booked).length,staffTotal),
  metric("entered","Entered",staff.filter((x:any)=>x.entered).length,staffTotal),
  metric("fitted","Fitted",staff.filter((x:any)=>x.fitted).length,staffTotal),
  metric("collected","Collected",staff.filter((x:any)=>x.collected).length,staffTotal),
  metric("photographed","Photographed",staff.filter((x:any)=>x.photographed).length,staffTotal),
 ];
 const enteredVip=Math.max(vip.filter((x:any)=>x.entered).length,(vips.data??[]).filter((x:any)=>["entered","arrived"].includes(x.arrival_status)).length);
 const vipAssigned=new Set((vips.data??[]).filter((x:any)=>x.seat_id).map((x:any)=>x.person_id||x.seat_id)).size;
 const guestTotal=attendance.guestTotal,enteredGuests=attendance.guestEntered;
 const guestMetrics=[metric("total","Total guest tickets",guestTotal,guestTotal),metric("entered","Entered guests",enteredGuests,guestTotal)];
 const vipMetrics=[metric("vip_total","Total VIP",vipTotal,vipTotal),metric("assigned","VIP seats assigned",vipAssigned,vipTotal),metric("entered","Entered",enteredVip,vipTotal)];
 const allGroups:OperationGroup[]=[
  {key:"students",title:"Students",subtitle:"Registration, payment, seating, services and ceremony entry.",metrics:studentMetrics},
  {key:"staff",title:"Academic staff",subtitle:"Seat assignment, gown services, photography and ceremony entry.",metrics:staffMetrics},
  {key:"guests",title:"Guests",subtitle:"Free and paid guest ticket entry based on accepted QR scans.",metrics:guestMetrics},
  {key:"vip",title:"VIP",subtitle:"VIP population, seating assignment and ceremony entry.",metrics:vipMetrics},
 ];
 let groups:OperationGroup[];
 if(["admin","regcom","land"].includes(p.role))groups=allGroups;
 else if(p.role==="scanner")groups=allGroups;
 else if(p.role==="vip")groups=[allGroups[3]];
 else groups=[{...allGroups[0],metrics:studentMetrics.filter(x=>["total","registered","paid"].includes(x.key))}];
 const exportsByRole:Record<string,[string,string][]>= {
  admin:[["master","Master users and operations"],["registration","Registration status"],["payments","Payment status"],["bookings","Bookings and seats"],["tickets","Tickets and QR"],["fittings","Fitting and collection"],["photography","Photography"],["entered_students","Entered students"],["entered_staff","Entered academic staff"],["entered_vip","Entered VIP"],["scans","Entry scans"],["finance","Finance and revenue"],["audit","Audit trail"]],
  regcom:[["registration","Registration status"],["bookings","Bookings and seats"],["tickets","Tickets and QR"],["fittings","Fitting and collection"],["photography","Photography"],["entered_students","Entered students"],["entered_staff","Entered academic staff"],["entered_vip","Entered VIP"],["scans","Entry scans"]],
  land:[["bookings","Bookings and seats"],["entered_students","Entered students"],["entered_staff","Entered academic staff"],["entered_vip","Entered VIP"],["scans","Entry scans"]],
  vip:[["entered_vip","Entered VIP"],["scans","VIP entry scans"]],
  finance:[["payments","Payment status"],["finance","Finance and revenue"]],
  scanner:[["entered_students","Entered students"],["entered_staff","Entered academic staff"],["entered_vip","Entered VIP"],["scans","Entry scans"]],
 };
 const exports=exportsByRole[p.role]||[];
 return <>
  <RealtimeRefresh table="entry_scans"/><RealtimeRefresh table="people_directory"/><RealtimeRefresh table="tickets"/><RealtimeRefresh table="fittings"/><RealtimeRefresh table="photo_sessions"/><RealtimeRefresh table="invitations"/><RealtimeRefresh table="vip_assignments"/>
  <div className="page-head"><div><span className="eyebrow">ANALYTICS & EXPORTS</span><h1>Reports and insights</h1><p>View operational reports and export the information available to your role.</p></div></div>
  <RoleOperationsOverview groups={groups}/>
  {["admin","regcom","land"].includes(p.role)&&<OperationalAnalytics college={group(students,"college")} degree={group(students,"degree")} program={group(students,"program")}/>} 
  <section className="card top-gap"><h2>Export reports</h2><div className="grid grid-4">{exports.map(([type,title])=><a key={type} className="report-tile" href={`/api/reports/export?type=${type}`}><strong>{title}</strong><p>Download current live CSV data.</p><span className="btn btn-secondary"><Download size={14}/>Export</span></a>)}</div></section>
 </>;
}
