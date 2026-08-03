"use client";
import {useEffect,useState} from "react";

type Tip={text:string;left:number;top:number;below:boolean}|null;
export function GlobalSeatTooltip(){
 const[tip,setTip]=useState<Tip>(null);
 useEffect(()=>{
  const onPointer=(event:Event)=>{
   const target=(event.target as HTMLElement)?.closest?.(".compact-seat:not(.aisle),.student-seat") as HTMLElement|null;
   if(!target)return;
   const text=target.getAttribute("aria-label")||target.getAttribute("title")||"";
   if(!text)return;
   const r=target.getBoundingClientRect();
   const width=Math.min(260,Math.max(190,window.innerWidth-24));
   let left=r.left+r.width/2-width/2;
   left=Math.max(12,Math.min(left,window.innerWidth-width-12));
   const below=r.top<110;
   const top=below?Math.min(window.innerHeight-90,r.bottom+10):Math.max(12,r.top-10);
   setTip({text,left,top,below});
  };
  const dismiss=(event:Event)=>{const el=event.target as HTMLElement;if(!el.closest?.(".compact-seat,.student-seat,.global-seat-tooltip"))setTip(null)};
  document.addEventListener("click",onPointer,true);
  document.addEventListener("focusin",onPointer,true);
  document.addEventListener("pointerdown",dismiss,true);
  const onScroll=()=>setTip(null);
  window.addEventListener("resize",onScroll);
  return()=>{document.removeEventListener("click",onPointer,true);document.removeEventListener("focusin",onPointer,true);document.removeEventListener("pointerdown",dismiss,true);window.removeEventListener("resize",onScroll)};
 },[]);
 if(!tip)return null;
 return <div className={`global-seat-tooltip ${tip.below?"below":"above"}`} style={{left:tip.left,top:tip.top}} role="status">{tip.text.split(" · ").map((x,i)=><span key={i}>{x}</span>)}</div>;
}
