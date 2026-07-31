"use client";
import {useEffect,useState} from "react";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
import {CheckCircle2,AlertTriangle,X} from "lucide-react";
export function FlashMessage(){
 const sp=useSearchParams(),router=useRouter(),pathname=usePathname();
 const ok=sp.get("success"),error=sp.get("error"); const [visible,setVisible]=useState(Boolean(ok||error));
 useEffect(()=>{setVisible(Boolean(ok||error));if(ok||error){const t=setTimeout(()=>{router.replace(pathname,{scroll:false})},4200);return()=>clearTimeout(t)}},[ok,error,pathname,router]);
 if(!visible||(!ok&&!error))return null;
 return <div className={`toast ${error?"toast-error":"toast-success"}`} role="status">{error?<AlertTriangle size={18}/>:<CheckCircle2 size={18}/>}<span>{error||ok}</span><button onClick={()=>setVisible(false)} aria-label="Dismiss"><X size={16}/></button></div>
}
