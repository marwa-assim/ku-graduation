"use client";
import {useDeferredValue,useEffect,useMemo,useState} from "react";

const PAGE_SIZE=25;
export function DataTable({columns,rows,search=true,placeholder="Search all columns..."}:{columns:{key:string;label:string;render?:(row:any)=>React.ReactNode}[];rows:any[];search?:boolean;placeholder?:string}){
 const[q,setQ]=useState("");const deferredQ=useDeferredValue(q);const[page,setPage]=useState(1);
 const filtered=useMemo(()=>{const x=deferredQ.trim().toLowerCase();if(!x)return rows;return rows.filter(r=>JSON.stringify(r).toLowerCase().includes(x))},[deferredQ,rows]);
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));useEffect(()=>setPage(1),[deferredQ,rows]);useEffect(()=>{if(page>pages)setPage(pages)},[page,pages]);
 const visible=useMemo(()=>filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),[filtered,page]);
 return <>{search&&<div className="table-toolbar"><input className="table-search" value={q} onChange={e=>setQ(e.target.value)} placeholder={placeholder}/><span className="badge">{filtered.length}/{rows.length}</span></div>}<div className="table-scroll-shell"><div className="table-wrap professional-table"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{visible.length?visible.map((r,i)=><tr key={r.id??i}>{columns.map(c=><td key={c.key} data-label={c.label}>{c.render?c.render(r):String(r[c.key]??"—")}</td>)}</tr>):<tr><td colSpan={columns.length} className="muted empty-cell">No records found.</td></tr>}</tbody></table></div></div>{pages>1&&<TablePager page={page} pages={pages} total={filtered.length} onPage={setPage}/>}</>}

export function TablePager({page,pages,total,onPage}:{page:number;pages:number;total:number;onPage:(page:number)=>void}){return <div className="table-pager" aria-label="Table pagination"><span>{total} record{total===1?"":"s"}</span><div><button type="button" className="btn btn-secondary btn-small" disabled={page<=1} onClick={()=>onPage(page-1)}>Previous</button><strong>Page {page} of {pages}</strong><button type="button" className="btn btn-secondary btn-small" disabled={page>=pages} onClick={()=>onPage(page+1)}>Next</button></div></div>}
