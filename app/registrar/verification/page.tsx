"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Loader2,
  RefreshCw,
  Mail,
  Phone,
  BookOpen,
  Calendar,
  FileText,
  Download,
  Image as ImageIcon,
} from "lucide-react";

import { supabase } from "@/app/lib/supabaseClient";

type StudentProfile = {
  id: string;
  full_name: string;
  email_address: string;
  student_id: string;
  course_program: string | null;
  year_level: string | null;
  contact_number: string | null;
  is_verified: boolean;
  verification_status: 'pending' | 'verified' | 'rejected';
  verification_notes: string | null;
  verification_documents: string[] | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
};

type VerificationDocument = {
  id: string;
  user_id: string;
  document_type: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  uploaded_at: string;
};

export default function RegistrarVerificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [verificationDocuments, setVerificationDocuments] = useState<VerificationDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchStudents = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      // Get user and verify role
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "registrar") {
        router.push("/student/home");
        return;
      }

      // Fetch students with verification info
      const { data: studentsData, error: studentsError } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email_address,
          student_id,
          course_program,
          year_level,
          contact_number,
          is_verified,
          verification_status,
          verification_notes,
          verification_documents,
          verified_at,
          verified_by,
          created_at,
          updated_at
        `)
        .eq("role", "student")
        .order("created_at", { ascending: false });

      if (studentsError) throw studentsError;

      setStudents(studentsData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.course_program?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchVerificationDocuments = async (studentId: string) => {
    setLoadingDocuments(true);
    try {
      const { data, error } = await supabase
        .from("verification_documents")
        .select("*")
        .eq("user_id", studentId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setVerificationDocuments(data || []);
    } catch (err) {
      console.error("Failed to fetch verification documents:", err);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleVerifyStudent = async (studentId: string) => {
    setUpdating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          is_verified: true,
          verification_status: 'verified',
          verification_notes: null,
          verified_at: new Date().toISOString(),
          verified_by: user.id,
        })
        .eq("id", studentId);

      if (updateError) throw updateError;

      setSuccessMessage("Student verified successfully!");
      await fetchStudents();
      setSelectedStudent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify student");
    } finally {
      setUpdating(false);
    }
  };

  const handleRejectStudent = async (studentId: string) => {
    if (!rejectReason.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }

    setUpdating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          is_verified: false,
          verification_status: 'rejected',
          verification_notes: rejectReason.trim(),
          verified_at: new Date().toISOString(),
          verified_by: user.id,
        })
        .eq("id", studentId);

      if (updateError) throw updateError;

      setSuccessMessage("Student verification rejected.");
      setRejectReason("");
      setShowRejectForm(false);
      await fetchStudents();
      setSelectedStudent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject verification");
    } finally {
      setUpdating(false);
    }
  };

  const handleResetVerification = async (studentId: string) => {
    if (!confirm("Are you sure you want to reset this student's verification status?")) {
      return;
    }

    setUpdating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          is_verified: false,
          verification_status: 'pending',
          verification_notes: null,
          verified_at: null,
          verified_by: null,
        })
        .eq("id", studentId);

      if (updateError) throw updateError;

      setSuccessMessage("Verification status reset to pending.");
      await fetchStudents();
      setSelectedStudent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset verification");
    } finally {
      setUpdating(false);
    }
  };

  const handleDownloadDocument = async (document: VerificationDocument) => {
    try {
      const { data } = await supabase.storage
        .from("verification-docs")
        .createSignedUrl(document.file_path, 3600);

      if (data?.signedUrl) {
        const link = window.document.createElement('a');
        link.href = data.signedUrl;
        link.download = document.file_name;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download document");
    }
  };

  const selectStudent = async (student: StudentProfile) => {
    setSelectedStudent(student);
    setShowRejectForm(false);
    setRejectReason("");
    await fetchVerificationDocuments(student.id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return CheckCircle;
      case 'rejected':
        return XCircle;
      case 'pending':
      default:
        return AlertCircle;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-sorsuMaroon mx-auto mb-4" />
          <p className="text-gray-600">Loading student verification...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between gap-3 max-w-[1600px] mx-auto w-full">
          <div className="flex items-center gap-3">
            <UserCheck className="h-6 w-6 text-sorsuMaroon" />
            <h1 className="text-xl font-bold text-gray-900">Student Verification</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/registrar/dashboard")}
              className="text-sm font-medium text-gray-600 hover:text-sorsuMaroon transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={fetchStudents}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6">
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Student List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
                  />
                </div>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-8 px-4 text-gray-500 text-sm">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    No students found.
                  </div>
                ) : (
                  filteredStudents.map((student) => {
                    const StatusIcon = getStatusIcon(student.verification_status);
                    return (
                      <button
                        key={student.id}
                        onClick={() => selectStudent(student)}
                        className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          selectedStudent?.id === student.id ? 'bg-maroon-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 text-sm">{student.full_name}</h3>
                            <p className="text-xs text-gray-600 font-mono">{student.student_id}</p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold border ${
                              getStatusColor(student.verification_status)
                            }`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {student.verification_status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {student.email_address}
                          </div>
                          {student.course_program && (
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              {student.course_program}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Student Details */}
          <div className="lg:col-span-2">
            {selectedStudent ? (
              <div className="space-y-6">
                {/* Student Info Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-sorsuMaroon h-2 w-full"></div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{selectedStudent.full_name}</h2>
                        <p className="text-sm text-gray-600 font-mono">{selectedStudent.student_id}</p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold border ${
                          getStatusColor(selectedStudent.verification_status)
                        }`}
                      >
                        {(() => {
                          const Icon = getStatusIcon(selectedStudent.verification_status);
                          return <Icon className="h-4 w-4" />;
                        })()}
                        {selectedStudent.verification_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                            <Mail className="h-3 w-3" /> Email Address
                          </div>
                          <p className="text-sm font-medium text-gray-900">{selectedStudent.email_address}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                            <Phone className="h-3 w-3" /> Contact Number
                          </div>
                          <p className="text-sm font-medium text-gray-900">{selectedStudent.contact_number || 'Not provided'}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                            <BookOpen className="h-3 w-3" /> Course & Year
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedStudent.course_program || 'Not specified'} 
                            {selectedStudent.year_level && ` • Year ${selectedStudent.year_level}`}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                            <Calendar className="h-3 w-3" /> Account Created
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(selectedStudent.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedStudent.verification_notes && (
                      <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-center gap-2 text-sm font-bold text-red-800 mb-1">
                          <AlertCircle className="h-4 w-4" />
                          Rejection Reason
                        </div>
                        <p className="text-sm text-red-700">{selectedStudent.verification_notes}</p>
                      </div>
                    )}

                    {selectedStudent.verified_at && (
                      <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 text-sm font-bold text-green-800 mb-1">
                          <CheckCircle className="h-4 w-4" />
                          Verification Details
                        </div>
                        <p className="text-sm text-green-700">
                          Verified on {new Date(selectedStudent.verified_at).toLocaleDateString()} by Registrar Staff
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Documents */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-sorsuMaroon" />
                    Verification Documents
                  </h3>

                  {loadingDocuments ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-sorsuMaroon mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading documents...</p>
                    </div>
                  ) : verificationDocuments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No verification documents uploaded</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {verificationDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                              {doc.mime_type?.startsWith('image/') ? (
                                <ImageIcon className="h-5 w-5 text-gray-600" />
                              ) : (
                                <FileText className="h-5 w-5 text-gray-600" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                              <p className="text-xs text-gray-500">
                                {doc.document_type} • {new Date(doc.uploaded_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDownloadDocument(doc)}
                            className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                            title="Download document"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Verification Actions */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-sorsuMaroon" />
                    Verification Actions
                  </h3>

                  {selectedStudent.verification_status === 'pending' && (
                    <div className="space-y-3">
                      <button
                        onClick={() => handleVerifyStudent(selectedStudent.id)}
                        disabled={updating}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-black text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                      >
                        {updating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Verify Student
                      </button>

                      {!showRejectForm ? (
                        <button
                          onClick={() => setShowRejectForm(true)}
                          className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject Verification
                        </button>
                      ) : (
                        <div className="space-y-3 p-4 border border-red-200 rounded-lg bg-red-50">
                          <div>
                            <label className="block text-sm font-medium text-red-800 mb-1">
                              Reason for Rejection *
                            </label>
                            <textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none min-h-[80px]"
                              placeholder="Please explain why this verification is being rejected..."
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRejectStudent(selectedStudent.id)}
                              disabled={updating || !rejectReason.trim()}
                              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                            >
                              {updating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Confirm Rejection'
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setShowRejectForm(false);
                                setRejectReason("");
                              }}
                              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedStudent.verification_status === 'verified' && (
                    <button
                      onClick={() => handleResetVerification(selectedStudent.id)}
                      disabled={updating}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                    >
                      {updating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Reset Verification Status
                    </button>
                  )}

                  {selectedStudent.verification_status === 'rejected' && (
                    <button
                      onClick={() => handleResetVerification(selectedStudent.id)}
                      disabled={updating}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                    >
                      {updating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Reset to Pending
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Student</h3>
                  <p className="text-gray-600">Choose a student from the list to view and manage their verification status.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
