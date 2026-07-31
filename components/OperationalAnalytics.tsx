"use client";
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid,PieChart,Pie,Cell} from "recharts";
export type AnalyticsDimension={name:string;registered:number;paid:number;fitted:number;collected:number;photographed:number;invited:number;booked:number};
const statuses=[
 ["registered","Registered"],["paid","Paid"],["fitted","Fitted"],["collected","Collected"],["photographed","Photographed"],["invited","Invitations sent"],["booked","Graduate seats booked"]
] as const;
function DarkTooltip({active,payload,label}:any){if(!active||!payload?.length)return null;const item=payload[0];return <div className="operations-tooltip"><strong>{label||item?.name}</strong><span>{Number(item?.value||0).toLocaleString()}</span></div>}
function Chart({title,data,keyName,index}:{title:string;data:AnalyticsDimension[];keyName:keyof AnalyticsDimension;index:number}){
 const clean=data.filter(x=>Number(x[keyName])>0||x.name==="Unassigned");
 if(index%3===2&&clean.length<=6){return <div className="card analytics-card"><h3>{title}</h3><div className="analytics-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={clean} dataKey={keyName as string} nameKey="name" innerRadius={38} outerRadius={74} paddingAngle={2} activeShape={undefined}>{clean.map((_,i)=><Cell key={i} fill={["#d4a843","#4a90d9","#27ae60","#8e6bd8","#e67e22","#16a085"][i%6]}/>)}</Pie><Tooltip content={<DarkTooltip/>} wrapperStyle={{outline:"none"}}/></PieChart></ResponsiveContainer></div></div>}
 return <div className="card analytics-card"><h3>{title}</h3><div className="analytics-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={clean} margin={{top:8,right:8,left:-18,bottom:48}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,.22)"/><XAxis dataKey="name" interval={0} angle={-28} textAnchor="end" height={60} tick={{fontSize:9,fill:"var(--muted)"}}/><YAxis allowDecimals={false} tick={{fontSize:9,fill:"var(--muted)"}}/><Tooltip content={<DarkTooltip/>} cursor={{fill:"transparent"}} wrapperStyle={{outline:"none"}}/><Bar dataKey={keyName as string} radius={[5,5,0,0]} fill={index%2===0?"#d4a843":"#4a90d9"} activeBar={false}/></BarChart></ResponsiveContainer></div></div>
}
export function OperationalAnalytics({college,degree,program}:{college:AnalyticsDimension[];degree:AnalyticsDimension[];program:AnalyticsDimension[]}){
 return <div className="analytics-suite">{statuses.map(([key,label],index)=><section key={key} className="analytics-status-section"><div className="section-title"><div><h2>{label}</h2><p>{label} distribution by college, degree and academic program.</p></div></div><div className="grid analytics-grid"><Chart title="By college" data={college} keyName={key} index={index}/><Chart title="By degree" data={degree} keyName={key} index={index+1}/><Chart title="By program" data={program} keyName={key} index={index+2}/></div></section>)}</div>
}
