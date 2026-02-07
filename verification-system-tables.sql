-- Verification System Tables
-- These tables support the student verification and ID validation system

-- Add verification fields to profiles table if they don't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS verification_documents TEXT[], -- Array of document paths
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);

-- Verification Documents Table
CREATE TABLE IF NOT EXISTS verification_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- e.g., 'ID Card', 'Birth Certificate', 'School ID'
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_verification_documents_user_id ON verification_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_documents_document_type ON verification_documents(document_type);

-- Enable Row Level Security for verification documents
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for verification documents
-- Students can only view their own verification documents
CREATE POLICY "Students can view own verification documents" ON verification_documents
    FOR SELECT USING (
        auth.uid() = user_id
    );

-- Students can upload their own verification documents
CREATE POLICY "Students can upload own verification documents" ON verification_documents
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

-- Students can update their own verification documents
CREATE POLICY "Students can update own verification documents" ON verification_documents
    FOR UPDATE USING (
        auth.uid() = user_id
    );

-- Students can delete their own verification documents
CREATE POLICY "Students can delete own verification documents" ON verification_documents
    FOR DELETE USING (
        auth.uid() = user_id
    );

-- Registrars can view all verification documents
CREATE POLICY "Registrars can view all verification documents" ON verification_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'registrar'
        )
    );

-- Registrars can manage all verification documents
CREATE POLICY "Registrars can manage verification documents" ON verification_documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'registrar'
        )
    );

-- Update RLS policies for profiles to include verification fields
-- Allow students to update their own verification documents array
CREATE POLICY "Students can update own verification documents array" ON profiles
    FOR UPDATE USING (
        auth.uid() = id
    )
    WITH CHECK (
        auth.uid() = id
    );

-- Create storage bucket for verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for verification documents bucket
-- Students can upload to their own folder
CREATE POLICY "Students can upload verification documents" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'verification-docs' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Students can view their own files
CREATE POLICY "Students can view own verification documents" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'verification-docs' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Registrars can access all verification documents
CREATE POLICY "Registrars can access all verification documents" ON storage.objects
    FOR ALL USING (
        bucket_id = 'verification-docs' AND
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'registrar'
        )
    );
