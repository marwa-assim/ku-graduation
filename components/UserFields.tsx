"use client";
import {useMemo,useState} from "react";
const ROLES=["student","admin","scanner","regcom","vip","land","finance","tailor","photographer","academic_staff"];
export function UserFields({r,colleges,degrees,programs}:{r?:any;colleges:any[];degrees:any[];programs:any[]}){
 const[type,setType]=useState(r?.person_type||"student"),[college,setCollege]=useState(r?.college_id||""),[degree,setDegree]=useState(r?.degree_level_id||"");
 const visiblePrograms=useMemo(()=>programs.filter((x:any)=>(!college||x.college_id===college)&&(!degree||x.degree_level_id===degree)),[programs,college,degree]);const isStudent=type==="student",isAcademic=type==="academic_staff",isVip=type==="vip"||type==="vip_invited";
 return <>
  <label>Full name<input name="full_name" defaultValue={r?.full_name||""} required/></label><label>Email<input name="email" type="email" defaultValue={r?.email||""}/></label>
  <label>Type<select name="person_type" value={type} onChange={e=>setType(e.target.value)}><option value="student">Student</option><option value="academic_staff">Academic staff</option><option value="administrative_staff">Administrative staff</option><option value="guest">Guest</option><option value="vip">VIP invited</option></select></label>
  {isVip?<><input type="hidden" name="role" value="vip"/><label>Role<input value="VIP invited (no login required)" disabled/></label></>:<label>Primary role<select name="role" defaultValue={r?.role||"student"}>{ROLES.map(x=><option key={x}>{x}</option>)}</select></label>}
  {!isVip&&<label>Additional roles<input name="additional_roles" defaultValue={(r?.roles||[]).filter((x:string)=>x!==r?.role).join("|")} placeholder="Example: regcom|scanner"/><small>Separate multiple roles with |</small></label>}
  <label>Reference / student ID<input name="reference_number" defaultValue={r?.reference_number||""} placeholder={isStudent?"Required unique student ID":"Optional; generated if blank"}/></label><label>Phone<input name="phone" defaultValue={r?.phone||""}/></label>
  {(isStudent||isAcademic)&&<label>College<select name="college_id" value={college} onChange={e=>setCollege(e.target.value)}><option value="">Select college</option>{colleges.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
  {isStudent&&<label>Degree<select name="degree_level_id" value={degree} onChange={e=>setDegree(e.target.value)}><option value="">Select degree</option>{degrees.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
  {isStudent&&<label>Program<select name="program_id" defaultValue={r?.program_id||""}><option value="">Select program</option>{visiblePrograms.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
  <label>Gender<select name="gender" defaultValue={r?.gender||""}><option value="">Not specified</option><option value="female">Female</option><option value="male">Male</option></select></label>
 </>
}
