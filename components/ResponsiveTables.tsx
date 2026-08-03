"use client";
import {useEffect} from "react";
export function ResponsiveTables(){
 useEffect(()=>{
  const enhance=()=>document.querySelectorAll<HTMLTableElement>(".professional-table table").forEach(table=>{
   const headers=[...table.querySelectorAll("thead th")].map(x=>(x.textContent||"").trim());
   table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach(row=>{
    if(row.dataset.mobileReady)return;row.dataset.mobileReady="1";
    [...row.children].forEach((cell,i)=>(cell as HTMLElement).dataset.label=headers[i]||`Field ${i+1}`);
    row.addEventListener("click",e=>{if(window.innerWidth>760)return;const t=e.target as HTMLElement;if(t.closest("button,a,input,select,textarea,form,details"))return;row.classList.toggle("mobile-expanded")});
   });
  });
  enhance();const o=new MutationObserver(enhance);o.observe(document.body,{subtree:true,childList:true});return()=>o.disconnect();
 },[]);
 return null;
}
