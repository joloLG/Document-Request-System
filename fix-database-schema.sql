-- SorSU Document Request System - Fixed Database Schema
-- This file resolves the search_path security warnings and 500 errors

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ========================================
-- 1. PROFILES TABLE
-- ========================================

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  student_id text unique not null,
  full_name text not null,
  email_address text unique not null,
  course_program text,
  contact_number text,
  role text default 'student' check (role in ('student', 'registrar')),
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ========================================
-- 2. REQUESTS TABLE
-- ========================================

create table requests (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) not null, 
  document_type text not null,
  year_level text,
  verification_url text, 
  status text default 'Pending' 
    check (status in ('Pending', 'On Process', 'Cancelled', 'Ready for Pick-up', 'Completed')),
  cancellation_reason text,
  encrypted_file_bucket text default 'documents',
  encrypted_file_path text,
  encryption_alg text default 'AES-GCM',
  encryption_iv text,
  encryption_salt text,
  encryption_iterations integer default 100000,
  original_file_name text,
  original_mime_type text,
  original_size_bytes bigint,
  decryption_key text,
  uploaded_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ========================================
-- 3. NOTIFICATIONS TABLE
-- ========================================

create table notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) not null,
  message text not null,
  is_read boolean default false,
  notification_type text default 'status_update' check (notification_type in ('status_update', 'document_ready', 'system')),
  related_request_id uuid references requests(id),
  created_at timestamp with time zone default now()
);

-- ========================================
-- 4. AUDIT LOG TABLE (for tracking changes)
-- ========================================

create table audit_log (
  id uuid default uuid_generate_v4() primary key,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_by uuid references profiles(id),
  changed_at timestamp with time zone default now()
);

-- ========================================
-- TRIGGERS AND FUNCTIONS (FIXED)
-- ========================================

-- Handle new user registration (FIXED - added search_path)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (
    id,
    student_id,
    full_name,
    email_address,
    course_program,
    contact_number,
    role
  )
  values (
    new.id,
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'course_program',
    new.raw_user_meta_data->>'contact_number',
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );

  return new;
end;
$$;

-- Audit trigger function (FIXED - added search_path)
create or replace function public.audit_trigger_function()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    insert into audit_log (table_name, record_id, action, old_values, changed_by)
    values (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), auth.uid());
  elsif TG_OP = 'UPDATE' then
    insert into audit_log (table_name, record_id, action, old_values, new_values, changed_by)
    values (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), auth.uid());
  elsif TG_OP = 'INSERT' then
    insert into audit_log (table_name, record_id, action, new_values, changed_by)
    values (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), auth.uid());
  end if;
  return null;
end;
$$;

-- Notification trigger for request status changes (FIXED - added search_path)
create or replace function public.notify_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_message text;
  notification_type text;
begin
  if NEW.status = 'Ready for Pick-up' then
    notification_message := 'Your document "' || NEW.document_type || '" is ready for pick-up!';
    notification_type := 'document_ready';
  elsif NEW.status = 'Completed' then
    notification_message := 'Your document "' || NEW.document_type || '" has been completed.';
    notification_type := 'document_ready';
  elsif NEW.status = 'Cancelled' then
    notification_message := 'Your document "' || NEW.document_type || '" request has been cancelled.';
    notification_type := 'status_update';
  else
    notification_message := 'Your document "' || NEW.document_type || '" status has been updated to: ' || NEW.status;
    notification_type := 'status_update';
  end if;

  insert into notifications (user_id, message, is_read, notification_type, related_request_id)
  values (NEW.user_id, notification_message, false, notification_type, NEW.id);

  return NEW;
end;
$$;

-- ========================================
-- TRIGGERS
-- ========================================

-- User registration trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Audit triggers
drop trigger if exists profiles_audit on profiles;
create trigger profiles_audit
after insert or update or delete on profiles
for each row execute procedure public.audit_trigger_function();

drop trigger if exists requests_audit on requests;
create trigger requests_audit
after insert or update or delete on requests
for each row execute procedure public.audit_trigger_function();

drop trigger if exists notifications_audit on notifications;
create trigger notifications_audit
after insert or update or delete on notifications
for each row execute procedure public.audit_trigger_function();

-- Notification trigger for request status changes
drop trigger if exists request_status_notification on requests;
create trigger request_status_notification
after update of status on requests
for each row execute procedure public.notify_status_change();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

alter table profiles enable row level security;
alter table requests enable row level security;
alter table notifications enable row level security;
alter table audit_log enable row level security;

-- ========================================
-- RLS POLICIES
-- ========================================

-- Profiles policies
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Registrar can view all profiles" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'registrar')
);

-- Requests policies
create policy "Students can view own requests" on requests for select using (auth.uid() = user_id);
create policy "Registrar can view all requests" on requests for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'registrar')
);
create policy "Students can create own requests" on requests for insert with check (auth.uid() = user_id);
create policy "Registrar can update requests" on requests for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'registrar')
);
create policy "Registrar can delete requests" on requests for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'registrar')
);

-- Notifications policies
create policy "Users can view own notifications" on notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on notifications for update using (auth.uid() = user_id);
create policy "Users can mark own notifications as read" on notifications for update using (auth.uid() = user_id);
create policy "Registrar can create notifications" on notifications for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'registrar')
);
create policy "Registrar can view all notifications" on notifications for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'registrar')
);

-- Audit log policies (read-only for admins)
create policy "Registrar can view audit log" on audit_log for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'registrar')
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

create index idx_requests_user_id on requests(user_id);
create index idx_requests_status on requests(status);
create index idx_requests_created_at on requests(created_at);
create index idx_notifications_user_id on notifications(user_id);
create index idx_notifications_is_read on notifications(is_read);
create index idx_notifications_created_at on notifications(created_at);
create index idx_audit_log_table_record on audit_log(table_name, record_id);
create index idx_audit_log_changed_at on audit_log(changed_at);

-- ========================================
-- VIEWS FOR COMMON QUERIES
-- ========================================

-- Student requests with user info
create view student_requests_view as
select 
  r.*,
  p.full_name,
  p.email_address,
  p.student_id as profile_student_id
from requests r
join profiles p on r.user_id = p.id
where p.role = 'student';

-- Request statistics
create view request_stats_view as
select 
  status,
  count(*) as count,
  date(created_at) as request_date
from requests
group by status, date(created_at);

-- Unread notifications count
create view unread_notifications_view as
select 
  user_id,
  count(*) as unread_count
from notifications
where is_read = false
group by user_id;

-- ========================================
-- STORAGE SETUP (Manual Process Required)
-- ========================================

-- STORAGE SETUP MUST BE DONE MANUALLY
-- ========================================
-- 
-- The SorSU Document System requires two storage buckets for file operations:
--
-- 1. "documents" - For encrypted document files
-- 2. "avatars" - For user profile images
--
-- SETUP INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to "Storage" section
-- 3. Create bucket named "documents" (Public: false)
-- 4. Create bucket named "avatars" (Public: false)
-- 5. Enable Row Level Security on storage objects
-- 6. Apply the storage policies (see below)
--
-- NOTE: These steps require storage admin permissions
-- Contact your Supabase project owner if you don't have these permissions

-- STORAGE POLICIES (run after buckets are created and RLS is enabled)
-- =================================================================

-- Documents bucket policies:
CREATE POLICY "Registrar can upload encrypted documents" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'registrar')
);

CREATE POLICY "Registrar can read encrypted documents" ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'registrar')
);

CREATE POLICY "Students can read own encrypted documents" ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.requests r
    WHERE r.encrypted_file_path = name
      AND r.user_id = auth.uid()
  )
);

-- Avatars bucket policies:
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = split_part(name, '/', 2)
);

CREATE POLICY "Users can read own avatar" ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = split_part(name, '/', 2)
);

CREATE POLICY "Everyone can read avatars" ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- STORAGE VERIFICATION (optional)
-- ========================
-- Run these queries to verify setup:
-- SELECT * FROM storage.buckets;
-- SELECT * FROM pg_policies WHERE tablename = 'storage.objects';

-- ========================================
-- DIAGNOSTIC SCRIPT (Optional)
-- ========================================

-- Run this to verify all components are working:
DO $$
DECLARE
    profiles_exists BOOLEAN;
    function_exists BOOLEAN;
    trigger_exists BOOLEAN;
BEGIN
    -- Check profiles table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'profiles' AND table_schema = 'public'
    ) INTO profiles_exists;
    
    -- Check function
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'handle_new_user' AND routine_schema = 'public'
    ) INTO function_exists;
    
    -- Check trigger
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'on_auth_user_created' AND trigger_schema = 'public'
    ) INTO trigger_exists;
    
    RAISE NOTICE 'Profiles table exists: %', profiles_exists;
    RAISE NOTICE 'handle_new_user function exists: %', function_exists;
    RAISE NOTICE 'on_auth_user_created trigger exists: %', trigger_exists;
    
    IF NOT profiles_exists THEN
        RAISE NOTICE 'ERROR: Profiles table is missing!';
    ELSIF NOT function_exists THEN
        RAISE NOTICE 'ERROR: handle_new_user function is missing!';
    ELSIF NOT trigger_exists THEN
        RAISE NOTICE 'ERROR: on_auth_user_created trigger is missing!';
    ELSE
        RAISE NOTICE 'SUCCESS: All components exist!';
    END IF;
END $$;

-- ========================================
-- SETUP COMPLETE
-- ========================================

/*
  FIXED ISSUES:
  ✅ Added search_path = public to all functions to resolve security warnings
  ✅ Fixed function definitions to prevent 500 errors
  ✅ Maintained all functionality while improving security
  
  NEXT STEPS:
  1. Apply this schema to your Supabase project
  2. Set up storage buckets manually via Dashboard
  3. Test user registration
  4. Verify all functionality works
*/
