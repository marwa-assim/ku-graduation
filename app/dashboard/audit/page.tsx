import {requireProfile} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {clearAuditLogs,deleteAuditLog} from "../actions";
import {Trash2} from "lucide-react";

export default async function AuditPage(){
 const p=await requireProfile();const s=await createClient();
 const{data,error}=await s.from("audit_log").select("id,table_name,record_id,operation,actor_id,created_at,old_data,new_data").eq("organization_id",p.organization_id).order("created_at",{ascending:false}).limit(500);
 if(error)return <div className="card"><h2>Audit trail unavailable</h2><p>{error.message}</p></div>;
 const canDelete=p.role==="admin";
 return <><div className="page-head"><div><span className="eyebrow">GOVERNANCE</span><h1>Audit trail</h1><p>Latest operational changes with user and timestamp evidence.</p></div>{canDelete&&<div className="actions"><form action={clearAuditLogs}><input type="hidden" name="mode" value="older30"/><button className="btn btn-secondary" type="submit">Delete logs older than 30 days</button></form><form action={clearAuditLogs}><input type="hidden" name="mode" value="all"/><button className="btn btn-danger" type="submit">Clear all logs</button></form></div>}</div><section className="card"><div className="table-wrap"><table><thead><tr><th>Date</th><th>Operation</th><th>Area</th><th>Record</th><th>Changed by</th><th>Details</th>{canDelete&&<th>Remove</th>}</tr></thead><tbody>{(data??[]).map((r:any)=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString("en-GB")}</td><td><span className="badge">{r.operation}</span></td><td>{r.table_name}</td><td>{r.record_id||"—"}</td><td>{r.actor_id||"System"}</td><td><details><summary>View change</summary><pre style={{maxWidth:520,whiteSpace:"pre-wrap"}}>{JSON.stringify({before:r.old_data,after:r.new_data},null,2)}</pre></details></td>{canDelete&&<td><form action={deleteAuditLog}><input type="hidden" name="id" value={r.id}/><button className="icon-btn danger" title="Delete audit record"><Trash2 size={15}/></button></form></td>}</tr>)}</tbody></table></div></section></>
}
