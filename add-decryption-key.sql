-- Migration to add decryption_key to requests table
ALTER TABLE requests ADD COLUMN IF NOT EXISTS decryption_key text;

-- Update the view to include the new column
DROP VIEW IF EXISTS registrar_requests_view;
CREATE VIEW registrar_requests_view AS
SELECT 
    r.id,
    r.user_id,
    r.document_type,
    r.year_level,
    r.verification_url,
    r.status,
    r.cancellation_reason,
    r.encrypted_file_bucket,
    r.encrypted_file_path,
    r.original_file_name,
    r.original_mime_type,
    r.decryption_key,
    r.created_at,
    p.student_id as school_id,
    p.full_name,
    p.email_address,
    p.course_program,
    p.contact_number
FROM requests r
JOIN profiles p ON r.user_id = p.id;
