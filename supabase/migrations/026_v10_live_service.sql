begin;
alter table public.event_services add column if not exists service_type text not null default 'general';
create index if not exists idx_event_services_live on public.event_services(event_id,service_type,status);
commit;
