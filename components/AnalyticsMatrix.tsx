"use client";
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid,Legend} from "recharts";
export type InsightRow={name:string;total:number;registered:number;paid:number;fitted:number;collected:number;photographed:number;invited:number;booked:number};
const series=[
 ["registered","Registered"],["paid","Paid"],["fitted","Fitted"],["collected","Collected"],["photographed","Photographed"],["invited","Invited"],["booked","Booked"]
] as const;
export function AnalyticsMatrix({title,data}:{title:string;data:InsightRow[]}){return <section className="card analytics-matrix"><div className="section-title"><div><h2>{title}</h2><p>Registration, payment, fitting, collection, photography, invitation and booking status.</p></div></div><div className="chart-box chart-box-large"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{top:10,right:20,left:0,bottom:70}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={85} tick={{fontSize:10}}/><YAxis allowDecimals={false}/><Tooltip/><Legend/>{series.map(([key,label],i)=><Bar key={key} dataKey={key} name={label} radius={[4,4,0,0]} fill={["#4a90d9","#d4a843","#27ae60","#8e6bd8","#e67e22","#16a085","#e74c3c"][i]}/>)}</BarChart></ResponsiveContainer></div></section>}
