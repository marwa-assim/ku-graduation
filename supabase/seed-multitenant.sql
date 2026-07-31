insert into organizations(name,slug,organization_type) values('Kingdom University','kingdom-university','university') on conflict(slug) do nothing;
with o as(select id from organizations where slug='kingdom-university') update events set organization_id=(select id from o),event_type='graduation' where organization_id is null;
-- Demo people removed. Add real users through the Users screen or CSV import.
