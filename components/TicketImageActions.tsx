"use client";
import {useState} from "react";
import {Download,Mail} from "lucide-react";
import {WhatsAppIcon} from "./WhatsAppIcon";

type Props={ticketId:string;personId:string;fileName?:string;compact?:boolean;allowShare?:boolean};

async function getTicketFile(ticketId:string,personId:string,fileName?:string){
 const url=`/api/tickets/image?ticketId=${encodeURIComponent(ticketId)}&personId=${encodeURIComponent(personId)}`;
 const response=await fetch(url,{cache:"no-store"});
 if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.error||"Could not create the ticket image");}
 const blob=await response.blob();
 return new File([blob],fileName||`graduation-ticket-${ticketId}.png`,{type:"image/png"});
}

async function nativeShare(file:File,title:string,text:string){
 const nav=navigator as Navigator & {canShare?:(data:ShareData)=>boolean};
 if(nav.share&&(!nav.canShare||nav.canShare({files:[file]}))){
  await nav.share({title,text,files:[file]});
  return true;
 }
 return false;
}

export function TicketImageActions({ticketId,personId,fileName,compact=false,allowShare=true}:Props){
 const[busy,setBusy]=useState<string|null>(null);
 const[msg,setMsg]=useState("");
 const download=async()=>{setBusy("download");setMsg("");try{const file=await getTicketFile(ticketId,personId,fileName);const url=URL.createObjectURL(file);const a=document.createElement("a");a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}catch(e:any){setMsg(e?.message||"Download failed")}finally{setBusy(null)}};
 const share=async(channel:"whatsapp"|"email")=>{setBusy(channel);setMsg("");try{
  const file=await getTicketFile(ticketId,personId,fileName);
  if(channel==="email"){
   const response=await fetch("/api/tickets/share",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({ticketId,personId})});
   const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.error||"Could not email the ticket");
  }
  const opened=await nativeShare(file,"Kingdom University graduation ticket",channel==="whatsapp"?"Share the attached graduation ticket image through WhatsApp.":"The ticket has been emailed to the recipient and administrators. You may also attach/share this image from your email application.");
  if(!opened){
   const url=URL.createObjectURL(file);const a=document.createElement("a");a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
   if(channel==="whatsapp")window.open("https://web.whatsapp.com/","_blank","noopener,noreferrer");
   else window.location.href="mailto:?subject=Kingdom%20University%20graduation%20ticket&body=Please%20attach%20the%20downloaded%20ticket%20image.";
   setMsg("Your browser cannot attach files automatically. The full ticket image was downloaded; attach it in the opened application.");
  }else if(channel==="email")setMsg("The full ticket image was emailed to the recipient and administrators.");
 }catch(e:any){if(e?.name!=="AbortError")setMsg(e?.message||"Sharing failed")}finally{setBusy(null)}};
 if(compact)return <div className="actions"><button type="button" className="icon-btn" title="Download full ticket image" disabled={!!busy} onClick={download}><Download size={15}/></button>{allowShare&&<><button type="button" className="icon-btn" title="Email full ticket image" disabled={!!busy} onClick={()=>share("email")}><Mail size={15}/></button><button type="button" className="icon-btn whatsapp" title="Share full ticket image" disabled={!!busy} onClick={()=>share("whatsapp")}><WhatsAppIcon size={16}/></button></>}{msg&&<small className="form-message">{msg}</small>}</div>;
 return <><button type="button" className="btn btn-primary" disabled={!!busy} onClick={download}><Download size={16}/>{busy==="download"?"Preparing…":"Download full ticket image"}</button>{allowShare&&<><button type="button" className="btn btn-secondary" disabled={!!busy} onClick={()=>share("email")}><Mail size={16}/>{busy==="email"?"Preparing…":"Email full ticket image"}</button><button type="button" className="btn whatsapp-btn" disabled={!!busy} onClick={()=>share("whatsapp")}><WhatsAppIcon size={18}/>{busy==="whatsapp"?"Preparing…":"Share ticket image"}</button></>}{msg&&<p className="form-message">{msg}</p>}</>;
}
