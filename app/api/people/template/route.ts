import {NextResponse} from "next/server";import{requireProfile}from"@/lib/auth";import{createClient}from"@/lib/supabase/server";
const q=(v:any)=>`"${String(v??"").replaceAll('"','""')}"`;
export async function GET(){const p=await requireProfile(["admin","regcom"]);const s=await createClient();const[c,d,g]=await Promise.all([s.from("colleges").select("name").eq("organization_id",p.organization_id).eq("active",true).order("name"),s.from("degree_levels").select("name").eq("organization_id",p.organization_id).eq("active",true).order("name"),s.from("academic_programs").select("name,college:colleges(name),degree:degree_levels(name)").eq("organization_id",p.organization_id).eq("active",true).order("name")]);
 const college=(c.data?.[0] as any)?.name||"College of IT",degree=(d.data?.[0] as any)?.name||"Bachelor",program=(g.data?.[0] as any)?.name||"Computer Science";
 const headers=["full_name","email","person_type","role","additional_roles","reference_number","phone","college","degree","program","gender","create_login","password"];
 const examples=[
 ["Example Student","student@example.com","student","student","","20260001","",college,degree,program,"female","yes","Student@2026"],
 ["Example Academic","academic@example.com","academic_staff","student","regcom","","",college,"","","male","yes","Academic@2026"],
 ["Example Admin Staff","admin@example.com","administrative_staff","admin","finance|scanner","","","","","","female","yes","Admin@2026"],
 ["Example Registration Committee","regcom@example.com","administrative_staff","regcom","","","","","","","female","yes","Regcom@2026"],
 ["Example Finance","finance@example.com","administrative_staff","finance","","","","","","","male","yes","Finance@2026"],
 ["Example Scanner","scanner@example.com","administrative_staff","scanner","","","","","","","male","yes","Scanner@2026"],
 ["Example Tailor","tailor@example.com","guest","tailor","","","","","","","","yes","Tailor@2026"],
 ["Example Academic Staff","academic@example.com","academic_staff","academic_staff","","","","","","","","yes","Photo@2026"],
 ["Example Venue Staff","venue@example.com","administrative_staff","land","","","","","","","","yes","Venue@2026"],
 ["Example VIP","vip@example.com","vip","vip","","VIP-001","","","","","","yes","Vip@2026"],
 ["Directory Guest Only","guest@example.com","guest","student","","","","","","","","no",""]
 ];
 const notes=["","VALID VALUES:","person_type: student | academic_staff | administrative_staff | guest | vip","role/additional_roles: student | academic_staff | admin | scanner | regcom | vip | land | finance | tailor | photographer","additional_roles: separate roles using |, for example finance|scanner","college, degree and program must exactly match names configured in Settings.",`Available colleges: ${(c.data??[]).map((x:any)=>x.name).join(" | ")||"None configured"}`,`Available degrees: ${(d.data??[]).map((x:any)=>x.name).join(" | ")||"None configured"}`,`Available programs: ${(g.data??[]).map((x:any)=>`${x.name} (${x.college?.name||""} / ${x.degree?.name||""})`).join(" | ")||"None configured"}`,"Student reference_number is required and must be unique. Other users may leave it blank; the system generates one.","password is required when create_login=yes. It is never stored in people_directory; Supabase Auth stores it securely."];
 const csv=[headers.map(q).join(","),...examples.map(r=>r.map(q).join(",")),...notes.map(x=>q(x))].join("\r\n");return new NextResponse("\uFEFF"+csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=users-import-template-with-examples.csv"}})}
