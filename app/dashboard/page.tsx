import {createClient} from "@/lib/supabase/server";
import {requireProfile} from "@/lib/auth";
import {DashboardInsights} from "@/components/DashboardInsights";
import {OperationalAnalytics,AnalyticsDimension} from "@/components/OperationalAnalytics";
import {RoleOperationsOverview,OperationGroup,OperationMetric} from "@/components/RoleOperationsOverview";
import {RealtimeRefresh} from "@/components/RealtimeRefresh";
import {visibleSeatLabel} from "@/lib/seat-label";
import {buildAttendance} from "@/lib/attendance";

function grouped(rows:any[],key:string):AnalyticsDimension[]{
 const m=new Map<string,AnalyticsDimension>();
 for(const r of rows){
  const name=r[key]||"Unassigned";
  const x=m.get(name)||{name,registered:0,paid:0,fitted:0,collected:0,photographed:0,invited:0,booked:0};
  if(r.registration_status==="registered")x.registered++;
  if(r.payment_status==="paid")x.paid++;
  if(r.fitting_status==="fitted")x.fitted++;
  if(r.collected_status==="collected")x.collected++;
  if(["photographed","delivered"].includes(r.photo_status))x.photographed++;
  if(r.invitation_status==="sent")x.invited++;
  if(r.graduate_seat)x.booked++;
  m.set(name,x);
 }
 return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name));
}

function metric(key:string,label:string,value:number,total:number):OperationMetric{
 return {key,label,value,total};
}

export default async function DashboardPage(){
 const p=await requireProfile();
 const s=await createClient();
 const {data:event}=await s.from("events").select("id,name").eq("organization_id",p.organization_id).order("ceremony_date",{ascending:false}).limit(1).maybeSingle();
 const eid=event?.id;
 const[pq,cq,dq,aq,fq,phq,iq,tq,sq,vq,esq]=await Promise.all([
  s.from("people_directory").select("id,profile_id,full_name,email,reference_number,gender,person_type,college_id,degree_level_id,program_id,registration_status,payment_status,invitation_status,role,arrival_status,arrived_at").eq("organization_id",p.organization_id).in("person_type",["student","academic_staff","administrative_staff","vip"]).order("full_name"),
  s.from("colleges").select("id,name").eq("organization_id",p.organization_id),
  s.from("degree_levels").select("id,name").eq("organization_id",p.organization_id),
  s.from("academic_programs").select("id,name").eq("organization_id",p.organization_id),
  s.from("fittings").select("person_id,status,collected_status").eq("organization_id",p.organization_id),
  s.from("photo_sessions").select("person_id,status").eq("organization_id",p.organization_id),
  s.from("invitations").select("person_id,status,sent_at").eq("organization_id",p.organization_id).match(eid?{event_id:eid}:{}),
  s.from("tickets").select("id,person_id,user_id,seat_id,status,is_extra").eq("organization_id",p.organization_id).match(eid?{event_id:eid}:{}),
  s.from("seats").select("id,code,label,seat_type,is_aisle").eq("organization_id",p.organization_id).match(eid?{event_id:eid}:{}),
  s.from("vip_assignments").select("person_id,seat_id,arrival_status").eq("organization_id",p.organization_id).match(eid?{event_id:eid}:{}),
  s.from("entry_scans").select("ticket_id,scanned_at,result").eq("organization_id",p.organization_id).eq("result","accepted")
 ]);
 const cm=new Map((cq.data??[]).map((x:any)=>[x.id,x.name]));
 const dm=new Map((dq.data??[]).map((x:any)=>[x.id,x.name]));
 const am=new Map((aq.data??[]).map((x:any)=>[x.id,x.name]));
 const fm=new Map((fq.data??[]).map((x:any)=>[x.person_id,x]));
 const pm=new Map((phq.data??[]).map((x:any)=>[x.person_id,x]));
 const im=new Map((iq.data??[]).map((x:any)=>[x.person_id,x]));
 const seatMap=new Map((sq.data??[]).map((x:any)=>[x.id,x]));
 const attendance=buildAttendance((tq.data??[]) as any[],(sq.data??[]) as any[],(esq.data??[]) as any[]);
 const by=new Map<string,any[]>();
 for(const t of tq.data??[]){for(const k of [t.person_id,t.user_id].filter(Boolean)){const a=by.get(k)||[];a.push({...t,seat:seatMap.get(t.seat_id)});by.set(k,a)}}
 const rows=(pq.data??[]).map((x:any)=>{
  const uniqueTickets=new Map<string,any>();
  for(const t of [...(by.get(x.id)||[]),...(x.profile_id?by.get(x.profile_id)||[]:[])]) uniqueTickets.set(t.id,t);
  const ts=[...uniqueTickets.values()];
  const main=ts.find((t:any)=>["graduate","staff"].includes(t.seat?.seat_type));
  const entry=attendance.personEntryByKey.get(String(x.id))||(x.profile_id?attendance.personEntryByKey.get(String(x.profile_id)):undefined);
  return {...x,college_name:cm.get(x.college_id)||"Unassigned",degree_name:dm.get(x.degree_level_id)||"Unassigned",program_name:am.get(x.program_id)||"Unassigned",graduate_seat:main?visibleSeatLabel(main.seat):"",free_guest_count:ts.filter((t:any)=>t.seat?.seat_type==="free_guest").length,paid_guest_count:ts.filter((t:any)=>t.seat?.seat_type==="paid_guest").length,extra_paid_count:ts.filter((t:any)=>t.seat?.seat_type==="paid_guest"&&t.is_extra).length,fitting_status:(fm.get(x.id)as any)?.status||"pending",collected_status:(fm.get(x.id)as any)?.collected_status||"pending",photo_status:(pm.get(x.id)as any)?.status||"pending",invitation_status:(im.get(x.id)as any)?.status||x.invitation_status||"pending",arrival_status:entry?"entered":"pending",arrived_at:entry?.scannedAt||null};
 });
 const students=rows.filter(x=>x.person_type==="student");
 const staff=rows.filter(x=>x.person_type==="academic_staff"&&(!x.role||x.role==="academic_staff"));
 const vips:any[]=[...new Map<string,any>(rows.filter((x:any)=>x.person_type==="vip").map((x:any)=>[String(x.id),x])).values()];

 const studentTotal=students.length;
 const staffTotal=staff.length;
 const vipTotal=vips.length;
 const registered=students.filter(x=>x.registration_status==="registered").length;
 const paid=students.filter(x=>x.payment_status==="paid").length;
 const studentFitted=students.filter(x=>x.fitting_status==="fitted").length;
 const studentCollected=students.filter(x=>x.collected_status==="collected").length;
 const studentPhoto=students.filter(x=>["photographed","delivered"].includes(x.photo_status)).length;
 const invited=students.filter(x=>x.invitation_status==="sent").length;
 const studentAssigned=students.filter(x=>x.graduate_seat).length;
 const enteredStudents=students.filter(x=>x.arrival_status==="entered").length;
 const enteredStaff=staff.filter(x=>x.arrival_status==="entered").length;
 const extraTickets=(tq.data??[]).filter((t:any)=>t.status==="valid"&&t.is_extra).length;
 const guestTotal=attendance.guestTotal;
 const enteredGuests=attendance.guestEntered;
 const enteredVip=Math.max(vips.filter(x=>x.arrival_status==="entered").length,(vq.data??[]).filter((x:any)=>["entered","arrived"].includes(x.arrival_status)).length);
 const staffAssigned=staff.filter(x=>x.graduate_seat).length;
 const staffFitted=staff.filter(x=>x.fitting_status==="fitted").length;
 const staffCollected=staff.filter(x=>x.collected_status==="collected").length;
 const staffPhoto=staff.filter(x=>["photographed","delivered"].includes(x.photo_status)).length;
 const vipAssigned=new Set((vq.data??[]).filter((x:any)=>x.seat_id).map((x:any)=>x.person_id||x.seat_id)).size;

 const studentMetrics=[
  metric("total","Total students",studentTotal,studentTotal),
  metric("registered","Registered",registered,studentTotal),
  metric("paid","Paid",paid,studentTotal),
  metric("assigned","Graduate seats assigned",studentAssigned,studentTotal),
  metric("entered","Entered",enteredStudents,studentTotal),
  metric("fitted","Fitted",studentFitted,studentTotal),
  metric("collected","Collected",studentCollected,studentTotal),
  metric("photographed","Photographed",studentPhoto,studentTotal),
  metric("invited","Invitations sent",invited,studentTotal),
 ];
 const staffMetrics=[
  metric("total","Total academic staff",staffTotal,staffTotal),
  metric("assigned","Staff seats assigned",staffAssigned,staffTotal),
  metric("entered","Entered",enteredStaff,staffTotal),
  metric("fitted","Fitted",staffFitted,staffTotal),
  metric("collected","Collected",staffCollected,staffTotal),
  metric("photographed","Photographed",staffPhoto,staffTotal),
 ];
 const guestMetrics=[
  metric("total","Total guest tickets",guestTotal,guestTotal),
  metric("entered","Entered guests",enteredGuests,guestTotal),
  metric("extra","Extra paid tickets",extraTickets,Math.max(extraTickets,guestTotal)),
 ];
 const vipMetrics=[
  metric("vip_total","Total VIP",vipTotal,vipTotal),
  metric("assigned","VIP seats assigned",vipAssigned,vipTotal),
  metric("entered","Entered",enteredVip,vipTotal),
 ];

 const allGroups:OperationGroup[]=[
  {key:"students",title:"Students",subtitle:"Registration, payment, seating, services and ceremony entry.",metrics:studentMetrics},
  {key:"staff",title:"Academic staff",subtitle:"Seat assignment, gown services, photography and ceremony entry.",metrics:staffMetrics},
  {key:"guests",title:"Guests",subtitle:"Free and paid guest ticket entry based on accepted QR scans.",metrics:guestMetrics},
  {key:"vip",title:"VIP",subtitle:"VIP population, seating assignment and ceremony entry.",metrics:vipMetrics},
 ];
 let groups:OperationGroup[]=[];
 if(["admin","regcom","land","scanner"].includes(p.role)) groups=allGroups;
 else if(p.role==="vip") groups=[allGroups[3]];
 else if(p.role==="finance") groups=[{...allGroups[0],metrics:studentMetrics.filter(x=>["total","registered","paid"].includes(x.key))}];
 else if(p.role==="tailor") groups=[{...allGroups[0],metrics:studentMetrics.filter(x=>["total","fitted","collected"].includes(x.key))},{...allGroups[1],metrics:staffMetrics.filter(x=>["total","fitted","collected"].includes(x.key))}];
 else if(p.role==="photographer") groups=[{...allGroups[0],metrics:studentMetrics.filter(x=>["total","photographed"].includes(x.key))},{...allGroups[1],metrics:staffMetrics.filter(x=>["total","photographed"].includes(x.key))}];
 else {
  const own = rows.find(
    (item: any) => item.profile_id === p.id || item.email === p.email
  );

  if (p.role === "academic_staff") {
    groups = [
      {
        key: "staff",
        title: "My academic staff status",
        subtitle: "Your personal ceremony readiness.",
        metrics: [
          metric(
            "assigned",
            "Seat assigned",
            own?.graduate_seat ? 1 : 0,
            1
          ),
          metric(
            "entered",
            "Entered",
            own?.arrival_status === "entered" ? 1 : 0,
            1
          ),
          metric(
            "fitted",
            "Fitted",
            own?.fitting_status === "fitted" ? 1 : 0,
            1
          ),
          metric(
            "collected",
            "Collected",
            own?.collected_status === "collected" ? 1 : 0,
            1
          ),
          metric(
            "photographed",
            "Photographed",
            ["photographed", "delivered"].includes(own?.photo_status)
              ? 1
              : 0,
            1
          ),
        ],
      },
    ];
  } else {
    groups = [
      {
        key: "students",
        title: "My student status",
        subtitle: "Your personal graduation readiness.",
        metrics: [
          metric(
            "registered",
            "Registered",
            own?.registration_status === "registered" ? 1 : 0,
            1
          ),
          metric(
            "paid",
            "Paid",
            own?.payment_status === "paid" ? 1 : 0,
            1
          ),
          metric(
            "assigned",
            "Seat assigned",
            own?.graduate_seat ? 1 : 0,
            1
          ),
          metric(
            "entered",
            "Entered",
            own?.arrival_status === "entered" ? 1 : 0,
            1
          ),
          metric(
            "fitted",
            "Fitted",
            own?.fitting_status === "fitted" ? 1 : 0,
            1
          ),
          metric(
            "collected",
            "Collected",
            own?.collected_status === "collected" ? 1 : 0,
            1
          ),
          metric(
            "photographed",
            "Photographed",
            ["photographed", "delivered"].includes(own?.photo_status)
              ? 1
              : 0,
            1
          ),
          metric(
            "extra",
            "Extra paid tickets",
            own?.extra_paid_count ?? 0,
            Math.max(1, own?.extra_paid_count ?? 0)
          ),
        ],
      },
    ];
  }
}

 const canSeeRegisters=["admin","regcom","land","scanner"].includes(p.role);
 const canSeeStudentAnalytics=["admin","regcom","land"].includes(p.role);
 return <>
  <RealtimeRefresh table="entry_scans"/><RealtimeRefresh table="people_directory"/><RealtimeRefresh table="tickets"/><RealtimeRefresh table="fittings"/><RealtimeRefresh table="photo_sessions"/><RealtimeRefresh table="vip_assignments"/>
  <div className="page-head"><div><span className="eyebrow">LIVE OPERATIONS</span><h1>{event?.name||"Graduation platform"}</h1><p>Current event status, progress and operational activity.</p></div>{["admin","regcom"].includes(p.role)&&<a className="btn btn-secondary" href="/api/reports/export?type=master">Export master CSV</a>}</div>
  <RoleOperationsOverview groups={groups}/>
  {canSeeStudentAnalytics&&<OperationalAnalytics college={grouped(students,"college_name")} degree={grouped(students,"degree_name")} program={grouped(students,"program_name")}/>} 
  {canSeeRegisters&&<><DashboardInsights rows={students} title="Complete student operations register" mode="student"/><DashboardInsights rows={staff} title="Complete academic staff operations register" mode="staff"/></>}
 </>;
}
