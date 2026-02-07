-- Enable Real-time for Base Tables Only
-- PostgreSQL real-time only works on base tables, not views

-- Drop existing publications if any to start fresh
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create publication for real-time on base tables only
CREATE PUBLICATION supabase_realtime FOR TABLE requests, profiles, notifications;

-- Grant permissions for realtime on base tables
GRANT SELECT ON requests TO authenticated;
GRANT SELECT ON requests TO anon;

GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;

GRANT SELECT ON notifications TO authenticated;
GRANT SELECT ON notifications TO anon;

-- Enable Row Level Security for realtime access
-- This ensures users can only see data they're supposed to see

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Students can view their own requests in realtime" ON requests;
DROP POLICY IF EXISTS "Registrars can view all requests in realtime" ON requests;
DROP POLICY IF EXISTS "Users can view their own profiles in realtime" ON profiles;
DROP POLICY IF EXISTS "Users can view their own notifications in realtime" ON notifications;

-- For requests table: Students can only see their own requests
CREATE POLICY "Students can view their own requests in realtime" ON requests
    FOR SELECT USING (
        auth.uid()::text = user_id::text
    );

-- For requests table: Registrars can see all requests
CREATE POLICY "Registrars can view all requests in realtime" ON requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'registrar'
        )
    );

-- For profiles table: Users can view their own profile
CREATE POLICY "Users can view their own profiles in realtime" ON profiles
    FOR SELECT USING (
        auth.uid()::text = id::text
    );

-- For notifications table: Users can view their own notifications
CREATE POLICY "Users can view their own notifications in realtime" ON notifications
    FOR SELECT USING (
        auth.uid()::text = user_id::text
    );

-- Note: Views (registrar_requests_view, student_requests_view, request_stats_view)
-- cannot be added to real-time publications. The real-time subscriptions
-- will work on the base tables and your application code will handle
-- the filtering and transformation logic.
