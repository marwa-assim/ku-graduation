import {Camera,CheckCircle2,GraduationCap,PackageCheck,Shirt,UserRound} from "lucide-react";

const statusLabel=(v?:string)=>String(v||"pending").replaceAll("_"," ");
const Status=({value}:{value?:string})=><span className={`badge status-${value||"pending"}`}>{statusLabel(value)}</span>;
const Field=({label,value}:{label:string;value:any})=><div className="personal-field"><span>{label}</span><strong>{value||"—"}</strong></div>;

export function PersonalFittingCard({row,role}:{row:any;role:"student"|"academic_staff"}){
 const f=row?.f;
 return <section className="personal-record-card ceremony-card">
  <div className="personal-record-head"><span className="personal-record-icon"><Shirt/></span><div><span className="eyebrow">MY GOWN</span><h2>{row?.full_name||"Gown fitting"}</h2><p>{role==="student"?"Your graduation gown fitting and collection details.":"Your academic staff gown fitting and collection details."}</p></div></div>
  <div className="personal-fields-grid"><Field label="ID" value={row?.reference_number}/><Field label="College" value={row?.college?.name}/>{role==="student"&&<><Field label="Degree" value={row?.degree?.name}/><Field label="Programme" value={row?.program?.name}/></>}<Field label="Gown size" value={f?.gown_size}/><div className="personal-field"><span>Fitting status</span><Status value={f?.status}/></div><div className="personal-field"><span>Collection status</span><Status value={f?.collected_status}/></div><Field label="Notes" value={f?.notes}/></div>
  <div className="personal-progress-row"><span><GraduationCap/> Gown prepared for the ceremony</span><span><PackageCheck/> Collection status is shown above</span></div>
 </section>
}

export function PersonalPhotographyCard({row,role}:{row:any;role:"student"|"academic_staff"}){
 const p=row?.photo;
 return <section className="personal-record-card ceremony-card">
  <div className="personal-record-head"><span className="personal-record-icon"><Camera/></span><div><span className="eyebrow">MY PHOTOGRAPHY</span><h2>{row?.full_name||"Photography"}</h2><p>{role==="student"?"Your graduation photography and delivery status.":"Your academic staff photography and delivery status."}</p></div></div>
  <div className="personal-fields-grid"><Field label="ID" value={row?.reference_number}/><Field label="College" value={row?.college?.name}/><div className="personal-field"><span>Photography status</span><Status value={p?.status}/></div><div className="personal-field"><span>Delivery status</span><Status value={p?.delivery_status}/></div><Field label="Photographed at" value={p?.photographed_at?new Date(p.photographed_at).toLocaleString():"—"}/><Field label="Delivered at" value={p?.delivered_at?new Date(p.delivered_at).toLocaleString():"—"}/><Field label="Notes" value={p?.notes}/></div>
  <div className="personal-progress-row"><span><UserRound/> Personal ceremony record</span><span><CheckCircle2/> Status updates appear automatically</span></div>
 </section>
}
