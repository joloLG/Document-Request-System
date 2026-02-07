-- Audit Log System Tables
-- These tables support comprehensive activity tracking and audit logging

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created_at ON audit_logs(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Audit Logs
-- Users can only view their own audit logs
CREATE POLICY "Users can view own audit logs" ON audit_logs
    FOR SELECT USING (
        auth.uid() = user_id
    );

-- Registrars can view all audit logs
CREATE POLICY "Registrars can view all audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'registrar'
        )
    );

-- Function to automatically log changes
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    -- Determine the action type
    DECLARE
        action_type TEXT;
        old_data JSONB;
        new_data JSONB;
    BEGIN
        IF TG_OP = 'INSERT' THEN
            action_type := 'CREATE_' || TG_TABLE_NAME;
            old_data := NULL;
            new_data := to_jsonb(NEW);
            RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
            action_type := 'UPDATE_' || TG_TABLE_NAME;
            old_data := to_jsonb(OLD);
            new_data := to_jsonb(NEW);
            RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
            action_type := 'DELETE_' || TG_TABLE_NAME;
            old_data := to_jsonb(OLD);
            new_data := NULL;
            RETURN OLD;
        ELSE
            RETURN NULL;
        END IF;
    END;
END;
$$ LANGUAGE plpgsql;

-- Generic audit trigger function that calls the above
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        ip_address,
        user_agent
    ) VALUES (
        COALESCE(
            current_setting('app.current_user_id', true)::UUID,
            (SELECT id FROM profiles WHERE email_address = current_setting('request.jwt.claims.sub', true))
        ),
        TG_OP || '_' || TG_TABLE_NAME,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
            WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD)
            ELSE NULL
        END,
        CASE
            WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
            WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW)
            ELSE NULL
        END,
        inet_client_addr(),
        current_setting('request.headers', true)::json->>'user-agent'
    );
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers for important tables
-- Document requests
CREATE TRIGGER audit_requests_trigger
    AFTER INSERT OR UPDATE OR DELETE ON requests
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Profiles (for user management)
CREATE TRIGGER audit_profiles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Notifications
CREATE TRIGGER audit_notifications_trigger
    AFTER INSERT OR UPDATE OR DELETE ON notifications
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Document templates
CREATE TRIGGER audit_document_templates_trigger
    AFTER INSERT OR UPDATE OR DELETE ON document_templates
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Email templates
CREATE TRIGGER audit_email_templates_trigger
    AFTER INSERT OR UPDATE OR DELETE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Verification documents
CREATE TRIGGER audit_verification_documents_trigger
    AFTER INSERT OR UPDATE OR DELETE ON verification_documents
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Notification preferences
CREATE TRIGGER audit_notification_preferences_trigger
    AFTER INSERT OR UPDATE OR DELETE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Function to log custom actions (for manual logging)
CREATE OR REPLACE FUNCTION log_custom_action(
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        ip_address,
        user_agent
    ) VALUES (
        p_user_id,
        p_action,
        p_entity_type,
        p_entity_id,
        p_old_values,
        p_new_values,
        COALESCE(p_ip_address, inet_client_addr()),
        COALESCE(p_user_agent, current_setting('request.headers', true)::json->>'user-agent')
    );
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old audit logs (keep last 90 days by default)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(p_days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < now() - (p_days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up old logs (if pg_cron is available)
-- This would require the pg_cron extension to be installed
-- SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT cleanup_old_audit_logs(90);');

-- View for audit log statistics
CREATE OR REPLACE VIEW audit_log_statistics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_actions,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT entity_type) as entity_types,
    array_agg(DISTINCT action) as actions
FROM audit_logs 
WHERE created_at >= now() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- View for user activity summary
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
    p.id as user_id,
    p.full_name,
    p.email_address,
    p.student_id,
    p.role,
    COUNT(al.id) as total_actions,
    MAX(al.created_at) as last_action,
    COUNT(DISTINCT DATE_TRUNC('day', al.created_at)) as active_days
FROM profiles p
LEFT JOIN audit_logs al ON p.id = al.user_id
WHERE p.role IS NOT NULL
GROUP BY p.id, p.full_name, p.email_address, p.student_id, p.role
ORDER BY total_actions DESC;

-- Grant permissions
GRANT SELECT ON audit_logs TO authenticated;
GRANT SELECT ON audit_log_statistics TO authenticated;
GRANT SELECT ON user_activity_summary TO authenticated;
GRANT EXECUTE ON FUNCTION log_custom_action TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs TO authenticated;
