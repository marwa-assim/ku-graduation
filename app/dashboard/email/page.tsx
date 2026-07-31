import {requireProfile} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {InvitationDesigner} from "@/components/InvitationDesigner";
import {RealtimeRefresh} from "@/components/RealtimeRefresh";
import {InvitationDelivery} from "@/components/InvitationDelivery";
import {StudentInvitationView} from "@/components/StudentInvitationView";

export default async function Page(){
 const p=await requireProfile(["admin","regcom","student"]);const s=await createClient();
 if(p.role==="student"){
  const [{data:person},{data:design},{data:event}]=await Promise.all([
   s.from("people_directory").select("id,full_name,reference_number,college:colleges(name),degree:degree_levels(name),program:academic_programs(name)").eq("organization_id",p.organization_id).eq("profile_id",p.id).maybeSingle(),
   s.from("invitation_designs").select("*").eq("organization_id",p.organization_id).order("updated_at",{ascending:false}).limit(1).maybeSingle(),
   s.from("events").select("id,name,venue,venue_address,map_url,ceremony_date,invitation_title,invitation_message,show_invitation_to_students").eq("organization_id",p.organization_id).order("ceremony_date",{ascending:false}).limit(1).maybeSingle()
  ]);
  if(!person)return <div className="card">Your student directory record is not linked to this login.</div>;
  const one=(v:any)=>Array.isArray(v)?v[0]||null:v||null;const college=one((person as any).college)?.name||"";const degree=one((person as any).degree)?.name||"";const program=one((person as any).program)?.name||"";
  if(event?.show_invitation_to_students===false)return <div className="card">The invitation is currently hidden by the administrator.</div>;
  return <><div className="page-head"><div><span className="eyebrow">MY INVITATION</span><h1>{event?.invitation_title||event?.name||"Graduation invitation"}</h1><p>{`This is your official invitation card for ${event?.name||"the graduation ceremony"}.`}</p></div></div><StudentInvitationView design={design} event={event} person={person} college={college} degree={degree} program={program}/></>
 }
 const [eq,dq,pq,iq,cq,gq,aq]=await Promise.all([
  s.from("events").select("id,name,venue,venue_address,map_url,latitude,longitude,ceremony_date").eq("organization_id",p.organization_id).order("ceremony_date",{ascending:false}),
  s.from("invitation_designs").select("*").eq("organization_id",p.organization_id).order("updated_at",{ascending:false}),
  s.from("people_directory").select("id,full_name,email,reference_number,person_type,college_id,degree_level_id,program_id,registration_status,payment_status").eq("organization_id",p.organization_id).eq("person_type","student").order("full_name"),
  s.from("invitations").select("person_id,status,sent_at").eq("organization_id",p.organization_id),
  s.from("colleges").select("id,name").eq("organization_id",p.organization_id),s.from("degree_levels").select("id,name").eq("organization_id",p.organization_id),s.from("academic_programs").select("id,name").eq("organization_id",p.organization_id)
 ]);
 const events:any[]=eq.data??[],designs:any[]=dq.data??[],students:any[]=pq.data??[],sent:any[]=iq.data??[];const collegeMap=new Map((cq.data??[]).map((x:any)=>[x.id,x.name])),degreeMap=new Map((gq.data??[]).map((x:any)=>[x.id,x.name])),programMap=new Map((aq.data??[]).map((x:any)=>[x.id,x.name]));
 const people=students.map(x=>({...x,college_name:collegeMap.get(x.college_id)||"",degree_name:degreeMap.get(x.degree_level_id)||"",program_name:programMap.get(x.program_id)||""}));const sentIds=new Set(sent.filter(x=>x.status==="sent").map(x=>x.person_id));
 return <><RealtimeRefresh table="people_directory" filter={`organization_id=eq.${p.organization_id}`}/><RealtimeRefresh table="invitations" filter={`organization_id=eq.${p.organization_id}`}/><div className="page-head"><div><span className="eyebrow">COMMUNICATION</span><h1>Invitation and ticket studio</h1><p>Design, preview and send personalized invitations to eligible students.</p></div><span className="realtime-note"><i/>Live data</span></div><div className="grid grid-3"><Stat n={people.length} t="Students"/><Stat n={sentIds.size} t="Invitations sent"/><Stat n={Math.max(people.length-sentIds.size,0)} t="Pending"/></div>{events.length?<InvitationDesigner events={events} design={designs[0]??null} students={people}/>:<div className="card top-gap">Create an event before designing invitations.</div>}<InvitationDelivery students={people} eventId={events[0]?.id||""} sentIds={[...sentIds]}/></>;
}
function Stat({n,t}:{n:number,t:string}){return <div className="card stat"><strong>{n}</strong><span>{t}</span></div>}
