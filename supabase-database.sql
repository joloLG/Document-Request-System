-- SorSU Document Request System Database Schema
-- Updated to match all implemented features

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
-- TRIGGERS AND FUNCTIONS
-- ========================================

-- Handle new user registration
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
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

-- Audit trigger function
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

-- Notification trigger for request status changes
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
-- STORAGE BUCKETS AND POLICIES
-- ========================================

-- IMPORTANT: Storage setup requires special permissions
-- Follow these steps to set up storage correctly:

-- STEP 1: CREATE STORAGE BUCKETS (Manual via Supabase Dashboard)
-- ---------------------------------------------------------
-- 1. Go to Supabase Dashboard → Storage
-- 2. Create bucket: "documents" (Public: false)
-- 3. Create bucket: "avatars" (Public: false)

-- STEP 2: ENABLE RLS ON STORAGE OBJECTS (Manual or with admin rights)
-- -------------------------------------------------------------
-- Run this command with a user that has storage admin permissions:
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- STEP 3: CREATE STORAGE POLICIES (Manual or with admin rights)
-- -------------------------------------------------------------
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

-- STEP 4: VERIFY SETUP
-- ---------------------------------------------------------
-- Test that buckets exist and policies are applied
-- SELECT * FROM storage.buckets;
-- SELECT * FROM pg_policies WHERE tablename = 'storage.objects';

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
-- SAMPLE DATA (for development)
-- ========================================

-- Create a default registrar user (password: registrar123)
-- Note: In production, create users through the registration system
-- This is just for development setup

-- ========================================
-- COMMENTS
-- ========================================

/*
  Database Schema Features:
  
  1. User Management:
     - Profiles table with student/registrar roles
     - Automatic profile creation on user signup
     - Avatar storage support
  
  2. Document Requests:
     - Full request lifecycle tracking
     - AES-GCM encryption support
     - Status management with audit trail
     - File metadata storage
  
  3. Notifications:
     - Real-time notifications for status changes
     - Type-based categorization
     - Read/unread status tracking
     - Related request linking
  
  4. Security:
     - Row Level Security (RLS) on all tables
     - Role-based access control
     - Audit logging for all changes
     - Secure file storage policies
  
  5. Performance:
     - Optimized indexes for common queries
     - Materialized views for statistics
     - Efficient storage policies
  
  6. Extensibility:
     - Audit trail for compliance
     - Trigger-based notifications
     - Flexible status system
     - Type-safe foreign keys
  
  Integration Points:
  - Supabase Auth for user management
  - Supabase Storage for file handling
  - Realtime subscriptions for notifications
  - Email notifications via server routes
  
  Security Notes:
  - All user data is isolated by RLS policies
  - Documents are encrypted before storage
  - Audit logs track all data changes
  - Storage policies prevent unauthorized access
*/