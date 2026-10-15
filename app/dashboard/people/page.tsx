In app/dashboard/people/page.tsx replace:

const hydrated=rows.map(r=>{const entry=attendance.personEntryByKey.get(String(r.id))||(r.profile_id?attendance.personEntryByKey.get(String(r.profile_id)):undefined);return {...r,college_name:cm.get(r.college_id),degree_name:dm.get(r.degree_level_id),program_name:pm.get(r.program_id),roles:r.profile_id?roles.get(r.profile_id)||[r.role]:[r.role],arrival_status:entry?"entered":"pending",arrived_at:entry?.scannedAt||null}});

with:

const hydrated=rows.map(r=>{
 const entry=attendance.personEntryByKey.get(String(r.id))||(r.profile_id?attendance.personEntryByKey.get(String(r.profile_id)):undefined);
 const manuallyEntered=r.arrival_status==="entered";
 return {...r,
  college_name:cm.get(r.college_id),degree_name:dm.get(r.degree_level_id),program_name:pm.get(r.program_id),
  roles:r.profile_id?roles.get(r.profile_id)||[r.role]:[r.role],
  arrival_status:(entry||manuallyEntered)?"entered":"pending",
  arrived_at:r.arrived_at||entry?.scannedAt||null
 };
});

Also ensure entry_scans query excludes reversed scans:

s.from("entry_scans").select("ticket_id,scanned_at,result").eq("organization_id",p.organization_id).eq("result","accepted").is("reversed_at",null)
