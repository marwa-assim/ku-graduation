"use client";
import {useState} from "react";
import {Plus,X} from "lucide-react";
export function AddPanel({buttonLabel,title,description,children,className=""}:{buttonLabel:string;title:string;description?:string;children:React.ReactNode;className?:string}){
 const[open,setOpen]=useState(false);
 return <>
  <button type="button" className="btn btn-primary" onClick={()=>setOpen(true)}><Plus size={16}/>{buttonLabel}</button>
  {open&&<section className={`card top-gap add-panel ${className}`}>
   <div className="row-between"><div className="section-title" style={{marginBottom:0}}><Plus/><div><h2>{title}</h2>{description&&<p>{description}</p>}</div></div><button type="button" className="icon-btn" onClick={()=>setOpen(false)} aria-label="Close"><X size={16}/></button></div>
   {children}
  </section>}
 </>
}
