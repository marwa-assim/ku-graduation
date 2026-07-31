import {requireProfile} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {UsersManager} from "@/components/UsersManager";
import {RealtimeRefresh} from "@/components/RealtimeRefresh";
import {buildAttendance} from "@/lib/attendance";

export default async function UsersPage(){
 const p=await requireProfile(["admin","regcom"]);const s=await createClient();
 const {data:event}=await s.from("events").select("id").eq("organization_id",p.organization_id).order("ceremony_date",{ascending:false}).limit(1).maybeSingle();
 const eid=event?.id;
 const[rq,cq,dq,pq,rrq,profilesQ,tq,sq,esq]=await Promise.all([
  s.from("people_directory").select("*").eq("organization_id",p.organization_id).order("full_name"),
  s.from("colleges").select("id,name").eq("organization_id",p.organization_id).eq("active",true).order("name"),
  s.from("degree_levels").select("id,name").eq("organization_id",p.organization_id).eq("active",true).order("name"),
  s.from("academic_programs").select("id,name,college_id,degree_level_id").eq("organization_id",p.organization_id).eq("active",true).order("name"),
  s.from("profile_roles").select("profile_id,role").eq("organization_id",p.organization_id),
  p.role==="admin"?s.from("profiles").select("id,email,full_name,role,phone,organization_id").eq("organization_id",p.organization_id).order("full_name"):Promise.resolve({data:[],error:null} as any),
  s.from("tickets").select("id,person_id,user_id,seat_id,status").eq("organization_id",p.organization_id).match(eid?{event_id:eid}:{}),
  s.from("seats").select("id,seat_type").eq("organization_id",p.organization_id).match(eid?{event_id:eid}:{}),
  s.from("entry_scans").select("ticket_id,scanned_at,result").eq("organization_id",p.organization_id).eq("result","accepted")
 ]);
 const attendance=buildAttendance((tq.data??[]) as any[],(sq.data??[]) as any[],(esq.data??[]) as any[]);
 const rows:any[]=rq.data??[],colleges:any[]=cq.data??[],degrees:any[]=dq.data??[],programs:any[]=pq.data??[];
 const cm=new Map(colleges.map(x=>[x.id,x.name])),dm=new Map(degrees.map(x=>[x.id,x.name])),pm=new Map(programs.map(x=>[x.id,x.name]));const roles=new Map<string,string[]>();(rrq.data??[]).forEach((x:any)=>roles.set(x.profile_id,[...(roles.get(x.profile_id)||[]),x.role]));
 const byProfile=new Map(rows.filter((r:any)=>r.profile_id).map((r:any)=>[r.profile_id,r]));
 const hydrated=rows.map(r=>{const entry=attendance.personEntryByKey.get(String(r.id))||(r.profile_id?attendance.personEntryByKey.get(String(r.profile_id)):undefined);return {...r,college_name:cm.get(r.college_id),degree_name:dm.get(r.degree_level_id),program_name:pm.get(r.program_id),roles:r.profile_id?roles.get(r.profile_id)||[r.role]:[r.role],arrival_status:entry?"entered":"pending",arrived_at:entry?.scannedAt||null}});
 if(p.role==="admin"){
  for(const profile of profilesQ.data??[]){
   if(byProfile.has(profile.id))continue;
   hydrated.push({id:profile.id,profile_id:profile.id,organization_id:p.organization_id,full_name:profile.full_name,email:profile.email,phone:profile.phone,reference_number:null,role:profile.role,roles:roles.get(profile.id)||[profile.role],person_type:"administrative_staff",active:true,is_profile_only:true,college_name:null,degree_name:null,program_name:null,arrival_status:"pending",arrived_at:null});
  }
 }
 hydrated.sort((a:any,b:any)=>String(a.full_name||"").localeCompare(String(b.full_name||"")));
 return <><RealtimeRefresh table="entry_scans"/><RealtimeRefresh table="people_directory"/><UsersManager rows={hydrated} colleges={colleges} degrees={degrees} programs={programs} canDelete={p.role==="admin"} role={p.role}/></>;
}
