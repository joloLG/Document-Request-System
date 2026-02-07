-- Notification System Tables
-- These tables support email templates and notification preferences

-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    template_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE
);

-- Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    email_notifications BOOLEAN DEFAULT true,
    in_app_notifications BOOLEAN DEFAULT true,
    request_updates BOOLEAN DEFAULT true,
    document_ready BOOLEAN DEFAULT true,
    status_changes BOOLEAN DEFAULT true,
    system_announcements BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Email Templates
-- Only registrars can manage email templates
CREATE POLICY "Registrars can manage email templates" ON email_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'registrar'
        )
    );

-- Only registrars can view email templates
CREATE POLICY "Registrars can view email templates" ON email_templates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'registrar'
        )
    );

-- RLS Policies for Notification Preferences
-- Users can view their own notification preferences
CREATE POLICY "Users can view own notification preferences" ON notification_preferences
    FOR SELECT USING (
        auth.uid() = user_id
    );

-- Users can update their own notification preferences
CREATE POLICY "Users can update own notification preferences" ON notification_preferences
    FOR UPDATE USING (
        auth.uid() = user_id
    )
    WITH CHECK (
        auth.uid() = user_id
    );

-- Users can insert their own notification preferences
CREATE POLICY "Users can insert own notification preferences" ON notification_preferences
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

-- Registrars can view all notification preferences
CREATE POLICY "Registrars can view all notification preferences" ON notification_preferences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'registrar'
        )
    );

-- Registrars can update all notification preferences
CREATE POLICY "Registrars can update all notification preferences" ON notification_preferences
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'registrar'
        )
    );

-- Updated_at trigger for email templates
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_email_templates_updated_at 
    BEFORE UPDATE ON email_templates 
    FOR EACH ROW EXECUTE FUNCTION update_email_templates_updated_at();

-- Updated_at trigger for notification preferences
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Insert default email templates
INSERT INTO email_templates (name, subject, html_content, template_type, created_by) VALUES
(
    'Request Status Update',
    'Document Request Update: {{document_type}}',
    '<p>Dear {{name}},</p>
    <p>Your request for <strong>{{document_type}}</strong> is now <strong>{{status}}</strong>.</p>
    <p>Please log in to the Student Portal for more details.</p>
    <p>Best regards,<br>SorSU Registrar Office</p>',
    'request_update',
    (SELECT id FROM profiles WHERE role = 'registrar' LIMIT 1)
),
(
    'Document Ready for Download',
    'Document Available: {{document_type}}',
    '<p>Dear {{name}},</p>
    <p>Your requested document <strong>{{document_type}}</strong> has been uploaded and is ready for download.</p>
    <p>Please log in to the Student Portal to access it.</p>
    <p>Best regards,<br>SorSU Registrar Office</p>',
    'document_ready',
    (SELECT id FROM profiles WHERE role = 'registrar' LIMIT 1)
),
(
    'Verification Approved',
    'Your Account Has Been Verified',
    '<p>Dear {{name}},</p>
    <p>Congratulations! Your account has been successfully verified.</p>
    <p>You can now request documents and use all features of the Student Portal.</p>
    <p>Best regards,<br>SorSU Registrar Office</p>',
    'verification_approved',
    (SELECT id FROM profiles WHERE role = 'registrar' LIMIT 1)
),
(
    'Verification Rejected',
    'Account Verification Update',
    '<p>Dear {{name}},</p>
    <p>Your account verification could not be completed at this time.</p>
    <p>Please check your submitted documents and try again, or contact the Registrar Office for assistance.</p>
    <p>Best regards,<br>SorSU Registrar Office</p>',
    'verification_rejected',
    (SELECT id FROM profiles WHERE role = 'registrar' LIMIT 1)
)
ON CONFLICT DO NOTHING;
