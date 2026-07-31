-- V13: production QR scan response with real catalogue names
begin;
create or replace function public.scan_ticket(p_qr_token text,p_scanned_by uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.tickets%rowtype;s public.seats%rowtype;p public.people_directory%rowtype;accepted_at timestamptz:=now();college_name text;program_name text;
begin
 if public.app_current_role() not in ('admin','scanner','regcom') then raise exception 'Not authorized to scan tickets'; end if;
 select * into t from public.tickets where qr_token=p_qr_token and organization_id=public.current_org() limit 1 for update;
 if not found then raise exception 'Invalid ticket'; end if;
 if t.status='cancelled' then raise exception 'Cancelled ticket'; end if;
 select * into s from public.seats where id=t.seat_id and organization_id=public.current_org();
 if not found or s.seat_type not in ('graduate','free_guest','paid_guest','staff') then raise exception 'Unsupported ticket category'; end if;
 if exists(select 1 from public.entry_scans where ticket_id=t.id and result='accepted') then raise exception 'Ticket has already been used'; end if;
 select * into p from public.people_directory where organization_id=public.current_org() and (id=t.person_id or profile_id=t.user_id) order by case when id=t.person_id then 0 else 1 end limit 1 for update;
 select name into college_name from public.colleges where id=p.college_id;
 select name into program_name from public.academic_programs where id=p.program_id;
 insert into public.entry_scans(ticket_id,scanned_by,scanned_at,result) values(t.id,p_scanned_by,accepted_at,'accepted');
 if s.seat_type in ('graduate','staff') and p.id is not null then update public.people_directory set arrival_status='entered',arrived_at=accepted_at,arrived_by=p_scanned_by where id=p.id; end if;
 return jsonb_build_object('accepted',true,'ticketId',t.id,'personName',case when s.seat_type in ('free_guest','paid_guest') then 'Guest of '||coalesce(p.full_name,'Participant') else coalesce(p.full_name,'Ticket holder') end,'referenceNumber',p.reference_number,'college',college_name,'program',program_name,'personType',case when s.seat_type='staff' then 'academic_staff' when s.seat_type in ('free_guest','paid_guest') then 'guest' else 'student' end,'ticketType',s.seat_type,'seatCode',coalesce(s.label,s.code),'arrivalStatus','entered','arrivedAt',accepted_at);
exception when unique_violation then raise exception 'Ticket has already been used';
end $$;
grant execute on function public.scan_ticket(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
