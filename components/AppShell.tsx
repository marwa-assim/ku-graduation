"use client";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import type {Profile} from "@/lib/types";
import {logout} from "../app/login/actions";import{switchActiveRole}from"../app/dashboard/role-actions";
import {LayoutDashboard,Building2,CalendarDays,Users,Armchair,BookOpenCheck,Ticket,Shirt,Camera,Crown,ConciergeBell,Mail,BarChart3,Settings,ScanLine,MapPinned,History,LogOut,Menu,X,Sun,Moon,Radio,Clock3,MapPin,CreditCard} from "lucide-react";
import {useEffect,useMemo,useState} from "react";
import {formatEventRange} from "@/lib/event-time";

type Item=[string,string,React.ComponentType<{size?:number}>];
const nav:Record<string,Item[]>={
academic_staff:[["/dashboard","Overview",LayoutDashboard],["/dashboard/events","Event",CalendarDays],["/dashboard/seats","My seat",Armchair],["/dashboard/services","Services",ConciergeBell],["/dashboard/fitting","My gown",Shirt],["/dashboard/photography","My photography",Camera],["/dashboard/tickets","My ticket",Ticket],["/dashboard/contact","Contact us",Mail]],
student:[["/dashboard","Overview",LayoutDashboard],["/dashboard/events","Event",CalendarDays],["/dashboard/seats","Book guest seats",Armchair],["/dashboard/services","Services",ConciergeBell],["/dashboard/tickets","Tickets & QR",Ticket],["/dashboard/email","My invitation",Mail],["/dashboard/fitting","My gown",Shirt],["/dashboard/photography","My photography",Camera],["/dashboard/contact","Contact us",Mail]],
admin:[["/dashboard","Dashboard",LayoutDashboard],["/dashboard/organizations","Organizations",Building2],["/dashboard/events","Events",CalendarDays],["/dashboard/people","Users",Users],["/dashboard/seats","Seating Designer",Armchair],["/dashboard/bookings","Bookings",BookOpenCheck],["/dashboard/tickets","Tickets",Ticket],["/dashboard/fitting","Fitting",Shirt],["/dashboard/photography","Photography",Camera],["/dashboard/vip","VIP",Crown],["/dashboard/services","Services",ConciergeBell],["/dashboard/email","Invitations",Mail],["/dashboard/reports","Reports & Insights",BarChart3],["/dashboard/finance","Finance",CreditCard],["/dashboard/audit","Audit trail",History],["/dashboard/settings","Settings",Settings],["/dashboard/contact","Contact us",Mail]],
scanner:[["/dashboard","Live entry dashboard",LayoutDashboard],["/dashboard/scanner","Gate scanner",ScanLine],["/dashboard/seats","Live seating map",MapPinned],["/dashboard/tickets","Ticket lookup",Ticket],["/dashboard/reports","Reports & Insights",BarChart3],["/dashboard/services","Services",ConciergeBell],["/dashboard/contact","Contact us",Mail]],
regcom:[["/dashboard","Committee Dashboard",LayoutDashboard],["/dashboard/events","Event",CalendarDays],["/dashboard/people","Student registration",Users],["/dashboard/seats","Seating map",Armchair],["/dashboard/fitting","Fitting",Shirt],["/dashboard/photography","Photography",Camera],["/dashboard/tickets","Tickets",Ticket],["/dashboard/vip","VIP list",Crown],["/dashboard/services","Services",ConciergeBell],["/dashboard/reports","Reports & Insights",BarChart3],["/dashboard/contact","Contact us",Mail]],
vip:[["/dashboard","VIP Dashboard",LayoutDashboard],["/dashboard/events","Event",CalendarDays],["/dashboard/vip","VIP guests",Crown],["/dashboard/seats","VIP seating",Armchair],["/dashboard/services","Services",ConciergeBell],["/dashboard/reports","Reports & Insights",BarChart3],["/dashboard/contact","Contact us",Mail]],
land:[["/dashboard","Venue Dashboard",LayoutDashboard],["/dashboard/events","Event",CalendarDays],["/dashboard/seats","Hall & Stage",MapPinned],["/dashboard/bookings","Bookings (view)",BookOpenCheck],["/dashboard/vip","VIP seating",Crown],["/dashboard/services","Services",ConciergeBell],["/dashboard/reports","Reports & Insights",BarChart3],["/dashboard/contact","Contact us",Mail]],
finance:[["/dashboard","Finance Dashboard",LayoutDashboard],["/dashboard/events","Event",CalendarDays],["/dashboard/seats","Hall & Stage",MapPinned],["/dashboard/bookings","Payments",BookOpenCheck],["/dashboard/finance","Revenue & expenses",CreditCard],["/dashboard/reports","Financial reports",BarChart3],["/dashboard/services","Services",ConciergeBell],["/dashboard/contact","Contact us",Mail]],
tailor:[["/dashboard","Overview",LayoutDashboard],["/dashboard/fitting","Fitting & Distribution",Shirt],["/dashboard/reports","Reports & Exports",BarChart3],["/dashboard/services","Services",ConciergeBell],["/dashboard/contact","Contact us",Mail]],
photographer:[["/dashboard","Overview",LayoutDashboard],["/dashboard/photography","Photography queue",Camera],["/dashboard/reports","Reports & Exports",BarChart3],["/dashboard/services","Services",ConciergeBell],["/dashboard/contact","Contact us",Mail]]};

export function AppShell({profile,organization,event,children}:{profile:any;organization:any;event:any;children:React.ReactNode}){
 const pathname=usePathname();
 const router=useRouter();
 const [open,setOpen]=useState(false),[dark,setDark]=useState(true),[now,setNow]=useState<number|null>(null),[profileOpen,setProfileOpen]=useState(false);
 useEffect(()=>{setNow(Date.now());const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t)},[]);
 useEffect(()=>{document.documentElement.dataset.theme=dark?"dark":"light"},[dark]);
 useEffect(()=>{setOpen(false);setProfileOpen(false)},[pathname]);
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);setProfileOpen(false)}};
  window.addEventListener("keydown",onKey);
  document.body.classList.toggle("nav-open",open);
  return()=>{window.removeEventListener("keydown",onKey);document.body.classList.remove("nav-open")};
 },[open]);
 const countdown=useMemo(()=>{if(!event?.ceremony_date)return"No active event";if(now===null)return"Calculating…";const d=new Date(event.ceremony_date).getTime()-now;if(d<=0)return"LIVE NOW";const days=Math.floor(d/86400000),h=Math.floor(d%86400000/3600000),m=Math.floor(d%3600000/60000);return`${days}d ${h}h ${m}m`},[event,now]);
 const ceremonyText=event?.ceremony_date?formatEventRange(event.ceremony_date,event.end_date):"Create or publish an event to activate the countdown.";
 const rawMap=String(event?.map_url||"").trim();
 const mapHref=event?.latitude!=null&&event?.longitude!=null
  ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${event.latitude},${event.longitude}`)}`
  : rawMap
    ? (/^https?:\/\//i.test(rawMap)?rawMap:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawMap)}`)
    : event?.venue_address||event?.venue
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event?.venue_address||event?.venue)}`
      : null;
 return <div className="shell">
  {open&&<button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
  <aside id="primary-navigation" className={`sidebar ${open?"open":""}`} aria-label="Primary navigation">
   <div className="brand-row"><img className="brand-logo" src={organization?.logo_url||"/ku-logo.png"} alt={organization?.name||"Organization logo"}/><div><div className="brand">{organization?.name||"Event Platform"}</div><div className="role">{profile.role}</div></div><button type="button" className="icon-btn mobile-only" aria-label="Close navigation" onClick={()=>setOpen(false)}><X size={18}/></button></div>
   <nav className="nav">{(nav[profile.role]||nav.student).filter(([h])=>profile.role!=="student"||((h!=="/dashboard/email"||event?.show_invitation_to_students!==false)&&(h!=="/dashboard/seats"||event?.student_seat_access_mode!=="hidden"))).map(([h,l,I])=><Link key={h} href={h} prefetch={false} onMouseEnter={()=>router.prefetch(h)} onFocus={()=>router.prefetch(h)} className={pathname===h?"active":""} onClick={()=>setOpen(false)}><I size={18}/><span>{l}</span></Link>)}</nav>
   <div className="sidebar-footer"><div className="tenant-chip"><Building2 size={15}/>{organization?.name||"Organization workspace"}</div></div>
  </aside>
  <main className="content">
   <div className="topline"><button type="button" className="icon-btn mobile-only" aria-label="Open navigation" aria-controls="primary-navigation" aria-expanded={open} onClick={()=>setOpen(true)}><Menu size={20}/></button><div className="topline-spacer"/><div className="top-actions"><button className="icon-btn" onClick={()=>setDark(x=>!x)} title="Toggle theme">{dark?<Sun size={17}/>:<Moon size={17}/>}</button><div className="profile-menu"><button type="button" className="user-summary user-summary-button" onClick={()=>setProfileOpen(x=>!x)} aria-expanded={profileOpen}><div className="avatar">{profile.full_name?.slice(0,1).toUpperCase()}</div><div><strong>{profile.full_name}</strong><div className="muted">{profile.email}</div></div></button>{profileOpen&&<div className="profile-card"><h3>Logged-in user</h3><dl><dt>Name</dt><dd>{profile.full_name||"—"}</dd><dt>ID</dt><dd>{(profile as any).reference_number||profile.id}</dd><dt>Email</dt><dd>{profile.email||"—"}</dd><dt>Role</dt><dd>{profile.role}</dd>{Array.isArray(profile.roles)&&profile.roles.length>1&&<><dt>Switch role</dt><dd><form action={switchActiveRole}><select name="role" defaultValue={profile.role} onChange={e=>e.currentTarget.form?.requestSubmit()}>{profile.roles.map((r:string)=><option key={r}>{r}</option>)}</select></form></dd></>}<dt>Type</dt><dd>{(profile as any).person_type||"—"}</dd><dt>College</dt><dd>{(profile as any).college?.name||"—"}</dd><dt>Program</dt><dd>{(profile as any).program?.name||"—"}</dd><dt>Degree</dt><dd>{(profile as any).degree?.name||"—"}</dd><dt>Phone</dt><dd>{(profile as any).phone||"—"}</dd></dl></div>}</div><form action={logout}><button className="btn btn-secondary"><LogOut size={16}/>Sign out</button></form></div></div>
   <section className={`event-context-banner event-context-banner-v2 ${countdown==="LIVE NOW"?"is-live":""}`}>
    <div className="event-banner-glow" aria-hidden="true"/>
    <div className="event-context-main"><span className="event-context-kicker"><CalendarDays size={13}/> ACTIVE CEREMONY</span><strong>{event?.name||"No active event selected"}</strong><small>{event?.ceremony_date?ceremonyText:"Create or publish an event to activate the countdown."}</small></div>
    <div className="event-context-countdown"><Clock3 size={22}/><div><span>{countdown==="LIVE NOW"?"CEREMONY STATUS":"STARTS IN"}</span><strong>{countdown}</strong></div></div>
    {mapHref?<a className="event-context-location event-location-link" href={mapHref} target="_blank" rel="noreferrer" title="Open GPS directions"><MapPin size={22}/><div><span>VENUE · GET DIRECTIONS</span><strong>{event?.venue||event?.venue_address||"Open GPS location"}</strong></div></a>:<div className="event-context-location"><MapPin size={22}/><div><span>VENUE</span><strong>{event?.venue||"Venue not set"}</strong></div></div>}
    {event?.live_stream_enabled&&event?.live_stream_url&&<Link className="live-link live-link-prominent" href="/dashboard/services"><Radio size={16}/>WATCH LIVE</Link>}
   </section>
   {children}
  </main>
 </div>
}
