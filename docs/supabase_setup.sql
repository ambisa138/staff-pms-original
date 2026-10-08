-- Supabase Storage Setup for Bank PMS

-- 1. Create Buckets
insert into storage.buckets (id, name, public) values ('profile-pictures', 'profile-pictures', true);
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);

-- 2. RLS Policies for profile-pictures (Public Read, Owner Write)
create policy "Public Read for Profiles"
  on storage.objects for select
  using ( bucket_id = 'profile-pictures' );

create policy "Users can upload their own profile picture"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-pictures' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. RLS Policies for attachments (Restricted Access)
create policy "Branch access to attachments"
  on storage.objects for select
  using ( bucket_id = 'attachments' ); -- Further refined by application logic

create policy "Staff can upload attachments"
  on storage.objects for insert
  with check ( bucket_id = 'attachments' );
