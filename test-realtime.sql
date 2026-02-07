-- Test Real-time Setup
-- Run this script to verify that real-time is properly configured

-- Check if publication exists
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- Check which tables are in the publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Test RLS policies for requests table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'requests';

-- Check if user has proper permissions
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'requests' 
AND grantee IN ('authenticated', 'anon');

-- Sample query to test the registrar_requests_view
-- This should return data if the view exists and has proper permissions
-- SELECT * FROM registrar_requests_view LIMIT 1;
