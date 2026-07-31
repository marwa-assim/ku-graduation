"use client";
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid} from "recharts";

function DarkTooltip({active,payload,label}:any){
 if(!active||!payload?.length)return null;
 return <div className="operations-tooltip"><strong>{label}</strong><span>{Number(payload[0].value||0).toLocaleString()}</span></div>
}

export function CeremonyMetrics({data,title="Ceremony operational status",description="Live attendance and operational indicators."}:{data:{name:string;value:number}[];title?:string;description?:string}){
 return <section className="card top-gap"><div className="section-title"><div><h2>{title}</h2><p>{description}</p></div></div><div className="analytics-chart" style={{height:360}}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{top:10,right:10,left:-10,bottom:80}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,.22)"/><XAxis dataKey="name" interval={0} angle={-28} textAnchor="end" height={90} tick={{fontSize:11,fill:"var(--muted)"}}/><YAxis allowDecimals={false} tick={{fontSize:10,fill:"var(--muted)"}}/><Tooltip content={<DarkTooltip/>} cursor={{fill:"transparent"}} wrapperStyle={{outline:"none"}}/><Bar dataKey="value" radius={[6,6,0,0]} fill="#d4a843" activeBar={false}/></BarChart></ResponsiveContainer></div></section>
}
