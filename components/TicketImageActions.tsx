"use client";
import {useEffect,useMemo,useState} from "react";
import {Download,Mail,Share2} from "lucide-react";
import {WhatsAppIcon} from "./WhatsAppIcon";

type Props={ticketId:string;personId:string;fileName?:string;compact?:boolean;allowShare?:boolean};
type ShareMeta={subject:string;body:string;title:string};

async function getTicketFile(ticketId:string,personId:string,fileName?:string){
 const url=`/api/tickets/image?ticketId=${encodeURIComponent(ticketId)}&personId=${encodeURIComponent(personId)}`;
 const response=await fetch(url,{cache:"no-store"});
 if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.error||"Could not create the ticket image");}
 const blob=await response.blob();
 return new File([blob],fileName||`graduation-ticket-${ticketId}.png`,{type:"image/png"});
}
async function getShareMeta(ticketId:string,personId:string){
 const response=await fetch(`/api/tickets/share-data?ticketId=${encodeURIComponent(ticketId)}&personId=${encodeURIComponent(personId)}`,{cache:"no-store"});
 const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.error||"Could not prepare sharing details");return body as ShareMeta;
}
function downloadFile(file:File){const url=URL.createObjectURL(file);const a=document.createElement("a");a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}

export function TicketImageActions({ticketId,personId,fileName,compact=false,allowShare=true}:Props){
 const[busy,setBusy]=useState<string|null>(null),[msg,setMsg]=useState(""),[file,setFile]=useState<File|null>(null),[meta,setMeta]=useState<ShareMeta|null>(null);
 const cacheKey=useMemo(()=>`${ticketId}:${personId}:${fileName||""}`,[ticketId,personId,fileName]);
 useEffect(()=>{let active=true;Promise.all([getTicketFile(ticketId,personId,fileName),getShareMeta(ticketId,personId)]).then(([f,m])=>{if(active){setFile(f);setMeta(m)}}).catch(()=>{});return()=>{active=false}},[cacheKey,ticketId,personId,fileName]);
 const ensure=async()=>{const f=file||await getTicketFile(ticketId,personId,fileName);const m=meta||await getShareMeta(ticketId,personId);setFile(f);setMeta(m);return{f,m}};
 const download=async()=>{setBusy("download");setMsg("");try{const{f}=await ensure();downloadFile(f)}catch(e:any){setMsg(e?.message||"Download failed")}finally{setBusy(null)}};
 const email=async()=>{setBusy("email");setMsg("");try{const{f,m}=await ensure();const nav=navigator as Navigator&{canShare?:(d:ShareData)=>boolean};if(nav.share&&(!nav.canShare||nav.canShare({files:[f]}))){await nav.share({title:m.subject,text:m.body,files:[f]});setMsg("Choose your email application and recipient.");return}downloadFile(f);window.location.href=`mailto:?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;setMsg("Email draft opened. The ticket image was downloaded because this browser cannot attach files automatically.")}catch(e:any){if(e?.name!=="AbortError")setMsg(e?.message||"Could not open the email draft")}finally{setBusy(null)}};
 const shareNative=async(preferWhatsapp=false)=>{setBusy(preferWhatsapp?"whatsapp":"share");setMsg("");try{if(!file||!meta){await ensure();setMsg("Ticket image is ready. Tap the share button again.");return}const f=file,m=meta;const nav=navigator as Navigator&{canShare?:(d:ShareData)=>boolean};if(nav.share&&(!nav.canShare||nav.canShare({files:[f]}))){await nav.share({title:m.subject,text:m.body,files:[f]});return}downloadFile(f);if(preferWhatsapp)window.open(`https://wa.me/?text=${encodeURIComponent(m.subject+"\n\n"+m.body)}`,"_blank","noopener,noreferrer");setMsg("The full ticket image was downloaded. Attach it in the opened application.")}catch(e:any){if(e?.name!=="AbortError")setMsg(e?.message||"Sharing failed")}finally{setBusy(null)}};
 if(compact)return <div className="actions ticket-share-actions"><button type="button" className="icon-btn" title="Download full ticket image" disabled={!!busy} onClick={download}><Download size={15}/></button>{allowShare&&<><button type="button" className="icon-btn" title="Open email draft" disabled={!!busy} onClick={email}><Mail size={15}/></button><button type="button" className="icon-btn whatsapp" title="Share ticket image" disabled={!!busy} onClick={()=>shareNative(true)}><WhatsAppIcon size={16}/></button><button type="button" className="icon-btn" title="Share with another app" disabled={!!busy} onClick={()=>shareNative(false)}><Share2 size={15}/></button></>}{msg&&<small className="form-message">{msg}</small>}</div>;
 return <div className="ticket-action-grid"><button type="button" className="btn btn-primary" disabled={!!busy} onClick={download}><Download size={16}/>{busy==="download"?"Preparing…":"Download full ticket image"}</button>{allowShare&&<><button type="button" className="btn btn-secondary" disabled={!!busy} onClick={email}><Mail size={16}/>{busy==="email"?"Preparing…":"Open email draft"}</button><button type="button" className="btn whatsapp-btn" disabled={!!busy} onClick={()=>shareNative(true)}><WhatsAppIcon size={18}/>{busy==="whatsapp"?"Preparing…":"Share on WhatsApp"}</button><button type="button" className="btn btn-secondary" disabled={!!busy} onClick={()=>shareNative(false)}><Share2 size={16}/>{busy==="share"?"Preparing…":"Share with another app"}</button></>}{msg&&<p className="form-message span-all">{msg}</p>}</div>;
}
