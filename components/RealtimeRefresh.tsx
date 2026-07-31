"use client";
import{useEffect}from"react";
import{useRouter}from"next/navigation";
import{createClient}from"@/lib/supabase/client";

export function RealtimeRefresh({table,filter}:{table:string;filter?:string}){
 const router=useRouter();
 useEffect(()=>{
  const supabase=createClient();
  let timer:ReturnType<typeof setTimeout>|null=null;
  const refresh=()=>{
   if(document.visibilityState!=="visible")return;
   if(timer)clearTimeout(timer);
   timer=setTimeout(()=>router.refresh(),650);
  };
  const channel=supabase.channel(`live-${table}-${filter||"all"}`).on("postgres_changes",{event:"*",schema:"public",table,filter},refresh).subscribe();
  return()=>{if(timer)clearTimeout(timer);void supabase.removeChannel(channel)};
 },[table,filter,router]);
 return null;
}
