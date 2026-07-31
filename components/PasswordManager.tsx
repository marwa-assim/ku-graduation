"use client";
import {useMemo,useState} from "react";
import {KeyRound,Search} from "lucide-react";
import {setUserPassword,sendPasswordReset} from "@/app/dashboard/actions";

export function PasswordManager({users}:{users:any[]}){
 const[q,setQ]=useState("");
 const[selected,setSelected]=useState<any|null>(null);
 const filtered=useMemo(()=>{const x=q.trim().toLowerCase();if(!x)return users.slice(0,20);return users.filter(u=>[u.full_name,u.email,u.reference_number,u.role,u.person_type].some(v=>String(v||"").toLowerCase().includes(x))).slice(0,30)},[q,users]);
 return <section className="card top-gap"><div className="section-title"><KeyRound/><div><h2>Password administration</h2><p>Search any login-enabled user, set a password directly, or send a reset link.</p></div></div>
  <div className="password-search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name, email, ID or role..."/></div>
  <div className="password-results">{filtered.map(u=><button type="button" key={u.profile_id} className={`password-user ${selected?.profile_id===u.profile_id?"selected":""}`} onClick={()=>setSelected(u)}><strong>{u.full_name}</strong><span>{u.email||"No email"}</span><small>{u.reference_number||u.role}</small></button>)}</div>
  {selected&&<div className="password-panel"><div><strong>{selected.full_name}</strong><span>{selected.email}</span></div><form action={setUserPassword} className="inline-form"><input type="hidden" name="profile_id" value={selected.profile_id}/><input type="password" name="password" minLength={8} required placeholder="New password (minimum 8 characters)"/><button className="btn btn-primary">Set password now</button></form>{selected.email&&<form action={sendPasswordReset}><input type="hidden" name="email" value={selected.email}/><button className="btn btn-secondary">Send reset email</button></form>}</div>}
 </section>
}
