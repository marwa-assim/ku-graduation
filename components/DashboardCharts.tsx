"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid } from "recharts";
export function DashboardCharts({collegeData,statusData}:{collegeData:{name:string;value:number}[];statusData:{name:string;value:number}[]}){
 return <div className="grid grid-2 dashboard-charts">
  <div className="card"><div className="section-title"><div><h2>Participants by college</h2><p>Current event population distribution</p></div></div><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={collegeData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="value" radius={[7,7,0,0]} fill="var(--gold)"/></BarChart></ResponsiveContainer></div></div>
  <div className="card"><div className="section-title"><div><h2>Ticket status</h2><p>Live issuance and admission readiness</p></div></div><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>{statusData.map((_,i)=><Cell key={i} fill={["#d4a843","#4a90d9","#27ae60","#e67e22","#e74c3c"][i%5]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div><div className="legend-row">{statusData.map((x,i)=><span key={x.name}><i style={{background:["#d4a843","#4a90d9","#27ae60","#e67e22","#e74c3c"][i%5]}}/>{x.name}: {x.value}</span>)}</div></div>
 </div>
}
