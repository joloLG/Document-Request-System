-- Enable Real-time for Document Requests Table
-- This script enables real-time subscriptions for the requests table

-- Drop existing publications if any to start fresh
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create publication for real-time
CREATE PUBLICATION supabase_realtime FOR TABLE requests;

-- Grant permissions for realtime
GRANT SELECT ON requests TO authenticated;
GRANT SELECT ON requests TO anon;

-- Enable Row Level Security for realtime access
-- This ensures users can only see requests they're supposed to see

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Students can view their own requests in realtime" ON requests;
DROP POLICY IF EXISTS "Registrars can view all requests in realtime" ON requests;

-- For students: can only see their own requests
CREATE POLICY "Students can view their own requests in realtime" ON requests
    FOR SELECT USING (
        auth.uid()::text = user_id::text
    );

-- For registrars: can see all requests
CREATE POLICY "Registrars can view all requests in realtime" ON requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'registrar'
        )
    );

-- Enable realtime for the table
-- Note: This might need to be done through the Supabase dashboard
-- or via the API as the SQL command might vary based on Supabase version

-- Additional: Enable realtime for notifications table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'notifications') THEN
        -- Add notifications to publication
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
        GRANT SELECT ON notifications TO authenticated;
        GRANT SELECT ON notifications TO anon;
        
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
        
        -- Policy for notifications
        CREATE POLICY "Users can view their own notifications" ON notifications
            FOR SELECT USING (
                auth.uid()::text = user_id::text
            );
    END IF;
END $$;
