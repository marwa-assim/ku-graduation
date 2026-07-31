-- v11.4: ensure every authenticated operational user is visible to Admin
alter table public.people_directory add column if not exists photo_url text;

insert into public.people_directory
 (organization_id,profile_id,email,full_name,person_type,reference_number,phone,role,active)
select p.organization_id,p.id,p.email,p.full_name,'administrative_staff'::public.person_type,null,p.phone,p.role,true
from public.profiles p
where p.organization_id is not null
  and not exists(select 1 from public.people_directory d where d.profile_id=p.id)
on conflict do nothing;

-- Maintain directory rows when new login profiles are created.
create or replace function public.sync_profile_to_people_directory()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.organization_id is not null then
    insert into public.people_directory(organization_id,profile_id,email,full_name,person_type,phone,role,active)
    values(new.organization_id,new.id,new.email,new.full_name,'administrative_staff'::public.person_type,new.phone,new.role,true)
    on conflict (organization_id,email) do update set
      profile_id=excluded.profile_id,full_name=excluded.full_name,phone=excluded.phone,role=excluded.role,active=true;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_profile_directory on public.profiles;
create trigger trg_sync_profile_directory after insert or update of email,full_name,phone,role,organization_id
on public.profiles for each row execute function public.sync_profile_to_people_directory();

create index if not exists idx_people_directory_profile_org on public.people_directory(organization_id,profile_id);
create index if not exists idx_tickets_org_event_person_status on public.tickets(organization_id,event_id,person_id,status);
notify pgrst,'reload schema';
