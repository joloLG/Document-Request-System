"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  FileText,
  Plus,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  Upload,
  User,
  GraduationCap,
  Award,
  BookOpen,
  Shield,
  FileCheck,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/app/lib/supabaseClient";
import { base64ToUint8, decryptAesGcm } from "@/app/lib/aesGcm";

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "On Process": "bg-blue-100 text-blue-800 border-blue-200",
  "Ready for Pick-up": "bg-purple-100 text-purple-800 border-purple-200",
  Completed: "bg-green-100 text-green-800 border-green-200",
  Cancelled: "bg-maroon-100 text-maroon-800 border-maroon-200",
};

const STATUS_ICONS: Record<string, LucideIcon> = {
  Pending: Clock,
  "On Process": Loader2,
  "Ready for Pick-up": CheckCircle,
  Completed: CheckCircle,
  Cancelled: XCircle,
};

const DOCUMENT_TYPES = [
  { value: "Certificate of Registration", label: "Certificate of Registration", icon: BookOpen },
  { value: "Certificate of Graduation", label: "Certificate of Graduation", icon: GraduationCap },
  { value: "Certificate of Enrollment", label: "Certificate of Enrollment", icon: Award },
  { value: "Transcript of Records", label: "Transcript of Records", icon: FileText },
  { value: "Diploma", label: "Diploma", icon: Award },
  { value: "Honorable Dismissal/Transfer Credentials", label: "Honorable Dismissal/Transfer Credentials", icon: FileCheck },
  { value: "Good Moral", label: "Good Moral Certificate", icon: Shield },
];

type StudentRequestRow = {
  id: string;
  document_type: string;
  status: string;
  created_at: string;
  encrypted_file_bucket: string | null;
  encrypted_file_path: string | null;
  encryption_iv: string | null;
  encryption_salt: string | null;
  encryption_iterations: number | null;
  original_file_name: string | null;
  original_mime_type: string | null;
};

export default function StudentHomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<StudentRequestRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [newDocumentType, setNewDocumentType] = useState("");
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Form fields for requirements
  const [studentId, setStudentId] = useState("");
  const [fullName, setFullName] = useState("");
  const [courseProgram, setCourseProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [identityVerification, setIdentityVerification] = useState<File | null>(null);

  const [keyByRequestId, setKeyByRequestId] = useState<Record<string, string>>({});
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchRequests = async () => {
    setError(null);
    const { data, error: reqError } = await supabase
      .from("requests")
      .select(
        "id, document_type, status, created_at, encrypted_file_bucket, encrypted_file_path, encryption_iv, encryption_salt, encryption_iterations, original_file_name, original_mime_type",
      )
      .order("created_at", { ascending: false });

    if (reqError) {
      setError(reqError.message);
      return;
    }

    setRequests((data as StudentRequestRow[]) ?? []);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setError(userError.message);
        setLoading(false);
        return;
      }

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // Get user profile information from metadata
      const metadata = user.user_metadata;
      setStudentId(metadata.student_id || "");
      setFullName(metadata.full_name || "");
      setCourseProgram(metadata.course_program || "");
      setEmail(metadata.email || "");
      setContactNumber(metadata.contact_number || "");

      // Try to get role from profiles table, fallback to user metadata
      let userRole = metadata.role || 'student';
      
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.warn('Profile query blocked by RLS, using user metadata');
        } else if (profile?.role) {
          userRole = profile.role;
        }
      } catch (error) {
        console.warn('Profile query failed, using user metadata:', error);
      }

      if (userRole === "registrar") {
        router.push("/registrar/dashboard");
        return;
      }

      await fetchRequests();
      setLoading(false);
    };

    void init();
  }, [router]);

  const handleCreateRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!userId) {
      setError("User not found.");
      return;
    }

    if (!newDocumentType.trim()) {
      setError("Please select a document type.");
      return;
    }

    if (!identityVerification) {
      setError("Please upload an identity verification document.");
      return;
    }

    setCreatingRequest(true);

    try {
      // Upload identity verification file
      const fileExt = identityVerification.name.split('.').pop();
      const fileName = `${userId}/identity_verification_${Date.now()}.${fileExt}`;
      
      // Attempt to upload to 'identity-verifications', fallback to 'documents' if bucket not found
      let uploadBucket = 'identity-verifications';
      console.log(`Attempting upload to bucket: ${uploadBucket}`);
      
      let { error: uploadError } = await supabase.storage
        .from(uploadBucket)
        .upload(fileName, identityVerification);

      // If bucket not found, try the fallback bucket 'documents'
      const isBucketNotFoundError = uploadError && (
        uploadError.message.includes('Bucket not found') || 
        (uploadError as { status?: number }).status === 404
      );

      if (isBucketNotFoundError) {
        console.warn(`Bucket '${uploadBucket}' not found or inaccessible, falling back to 'documents'`);
        uploadBucket = 'documents';
        const fallbackResult = await supabase.storage
          .from(uploadBucket)
          .upload(fileName, identityVerification);
        uploadError = fallbackResult.error;
      }

      if (uploadError) {
        console.error("Upload error details:", uploadError);
        throw new Error(`Failed to upload identity verification: ${uploadError.message}. (Bucket: ${uploadBucket})`);
      }

      console.log(`Successfully uploaded to ${uploadBucket}/${fileName}`);

      // Create request with all requirements
      const { error: insertError } = await supabase.from("requests").insert({
        user_id: userId,
        document_type: newDocumentType.trim(),
        status: "Pending",
        year_level: yearLevel,
        verification_url: `${uploadBucket}/${fileName}`,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Reset form
      setNewDocumentType("");
      setYearLevel("");
      setIdentityVerification(null);
      setSuccessMessage("Document request submitted successfully!");
      setShowCreateForm(false);
      await fetchRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create request.");
    } finally {
      setCreatingRequest(false);
    }
  };

  const handleDecryptAndDownload = async (request: StudentRequestRow) => {
    setError(null);
    setSuccessMessage(null);

    if (!request.encrypted_file_bucket || !request.encrypted_file_path) {
      setError("This request does not have an encrypted document yet.");
      return;
    }

    if (!request.encryption_iv || !request.encryption_salt || !request.encryption_iterations) {
      setError("Missing encryption metadata for this document.");
      return;
    }

    const passphrase = keyByRequestId[request.id] ?? "";
    if (!passphrase) {
      setError("Please enter the decryption key.");
      return;
    }

    setBusyRequestId(request.id);

    try {
      const { data: encryptedBlob, error: downloadError } = await supabase.storage
        .from(request.encrypted_file_bucket)
        .download(request.encrypted_file_path);

      if (downloadError || !encryptedBlob) {
        throw new Error(downloadError?.message ?? "Download failed.");
      }

      try {
        const encryptedBuffer = await encryptedBlob.arrayBuffer();
        const plaintextBuffer = await decryptAesGcm({
          ciphertext: encryptedBuffer,
          passphrase,
          iv: base64ToUint8(request.encryption_iv),
          salt: base64ToUint8(request.encryption_salt),
          iterations: request.encryption_iterations,
        });

        const mimeType = request.original_mime_type || "application/octet-stream";
        const outBlob = new Blob([plaintextBuffer], { type: mimeType });
        const url = URL.createObjectURL(outBlob);

        const link = document.createElement("a");
        link.href = url;
        link.download = request.original_file_name ?? "document";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        setSuccessMessage("Document decrypted and downloaded.");
      } catch {
        throw new Error("Invalid decryption key. Please try again.");
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Decryption failed.");
    } finally {
      setBusyRequestId(null);
    }
  };

  const filteredRequests = requests.filter((r) =>
    r.document_type.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-50 transition-colors duration-300">
      {/* Header with SorSU Branding */}
      <div className="bg-gradient-to-r from-sorsuMaroon to-maroon-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <Image
                src="/images/sorsu-logo.png"
                alt="SorSU Logo"
                width={60}
                height={60}
                className="w-16 h-16 rounded-lg bg-white p-2"
              />
              <div>
                <h1 className="text-2xl font-bold text-white">SorSU Document Request System</h1>
                <p className="text-maroon-100">Sorsogon State University - Student Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
              <User className="h-5 w-5" />
              <span className="font-medium text-white">{fullName || "Student"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-xl shadow-lg border border-maroon-100 p-6 mb-8 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back, {fullName}!</h2>
              <p className="text-gray-600">Manage your document requests and track their status</p>
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4 text-sorsuMaroon" />
                  <span className="text-gray-700 font-medium">{courseProgram || "Program not set"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-sorsuMaroon" />
                  <span className="text-gray-700 font-medium">ID: {studentId || "Not set"}</span>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-maroon-50 rounded-lg px-4 py-2 border border-maroon-100">
              <FileText className="h-5 w-5 text-sorsuMaroon" />
              <span className="text-maroon-900 font-bold">{requests.length} Requests</span>
            </div>
          </div>
        </div>

        {/* Document Types Grid */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Available Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {DOCUMENT_TYPES.map((doc) => {
              const Icon = doc.icon;
              return (
                <div
                  key={doc.value}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:border-maroon-300 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => {
                    setNewDocumentType(doc.value);
                    setShowCreateForm(true);
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-maroon-50 text-sorsuMaroon transition-colors group-hover:bg-sorsuMaroon group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm group-hover:text-sorsuMaroon transition-colors">{doc.label}</h4>
                  </div>
                  <p className="text-xs text-gray-500">Click to request</p>
                </div>
              );
            })}
          </div>
        </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-lg border border-maroon-100 p-12 transition-colors">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-sorsuMaroon" />
            <p className="mt-4 text-lg text-gray-600 font-medium">Loading your requests...</p>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-maroon-200 bg-maroon-50 p-4 text-maroon-800 mb-6 transition-colors shadow-sm">
              <AlertCircle className="h-5 w-5 shrink-0 text-maroon-600" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 mb-6 transition-colors shadow-sm">
              <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {/* Actions Bar */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-8 transition-colors">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  name="search-documents-field"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-colors shadow-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center justify-center gap-2 rounded-lg bg-sorsuMaroon px-6 py-3 font-bold text-white hover:bg-maroon-900 transition-all shadow-md active:scale-95"
              >
                <Plus className="h-5 w-5" />
                New Request
              </button>
            </div>
          </div>

          {/* Create Request Form */}
          {showCreateForm && (
            <div className="bg-white rounded-xl shadow-xl border border-maroon-100 p-6 mb-8 transition-colors animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-maroon-50 text-sorsuMaroon">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Create New Document Request</h3>
                  <p className="text-gray-600 font-medium">Fill in the required information below</p>
                </div>
              </div>

              <form onSubmit={handleCreateRequest} className="space-y-6">
                {/* Student Information Section */}
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 transition-colors shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <User className="h-5 w-5 text-sorsuMaroon" />
                    Student Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Student ID Number
                      </label>
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-colors shadow-sm"
                        placeholder="e.g., 2021-0000-X"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-colors shadow-sm"
                        placeholder="e.g., Juan Dela Cruz"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Course Program
                      </label>
                      <input
                        type="text"
                        value={courseProgram}
                        onChange={(e) => setCourseProgram(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-colors shadow-sm"
                        placeholder="e.g., Bachelor of Science in Computer Science"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Year Level / Year Graduated
                      </label>
                      <input
                        type="text"
                        value={yearLevel}
                        onChange={(e) => setYearLevel(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-colors shadow-sm"
                        placeholder="e.g., 3rd Year or 2023"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-colors shadow-sm"
                        placeholder="student@sorsu.edu.ph"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Contact Number
                      </label>
                      <input
                        type="tel"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-colors shadow-sm"
                        placeholder="09XXXXXXXXX"
                      />
                    </div>
                  </div>
                </div>

                {/* Document Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Document or Certificate to Request
                  </label>
                  <select
                    value={newDocumentType}
                    onChange={(e) => setNewDocumentType(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-colors shadow-sm font-medium"
                  >
                    <option value="">Select a document type</option>
                    {DOCUMENT_TYPES.map((doc) => (
                      <option key={doc.value} value={doc.value}>
                        {doc.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Identity Verification */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Identity Verification
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-maroon-400 transition-colors bg-gray-50/50 shadow-inner">
                    <input
                      type="file"
                      id="identity-file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => setIdentityVerification(e.target.files?.[0] || null)}
                      required
                    />
                    <label
                      htmlFor="identity-file"
                      className="cursor-pointer flex flex-col items-center gap-3"
                    >
                      <Upload className="h-10 w-10 text-gray-400 group-hover:text-sorsuMaroon transition-colors" />
                      <span className="text-sm font-semibold text-gray-700">
                        {identityVerification ? identityVerification.name : "Upload Student ID, Government ID, or Payment Receipt"}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">PDF, JPG, PNG up to 10MB</span>
                    </label>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={creatingRequest}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sorsuMaroon px-6 py-3.5 font-bold text-white hover:bg-maroon-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-maroon-900/20 active:scale-[0.98]"
                  >
                    {creatingRequest ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Creating Request...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5" />
                        Submit Request
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-8 py-3.5 font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors border border-gray-200 shadow-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Requests List */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Your Document Requests</h3>
            
            {filteredRequests.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center transition-colors">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {searchTerm ? "No matching requests found" : "No document requests yet"}
                </h3>
                <p className="text-gray-500 font-medium mb-8">
                  {searchTerm 
                    ? "Try adjusting your search terms" 
                    : "Create your first document request to get started"
                  }
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-sorsuMaroon px-8 py-3.5 font-bold text-white hover:bg-maroon-900 transition-all shadow-lg active:scale-95"
                  >
                    <Plus className="h-5 w-5" />
                    Create First Request
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredRequests.map((request) => {
                  const StatusIcon = STATUS_ICONS[request.status] || AlertCircle;
                  const isActive = busyRequestId === request.id;
                  const key = keyByRequestId[request.id] || "";
                  const canDownload = request.status === "Ready for Pick-up" || request.status === "Completed";

                  return (
                    <div
                      key={request.id}
                      className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                              {request.document_type}
                            </h3>
                            <p className="text-sm text-gray-600 font-medium">
                              Requested on {new Date(request.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border ${STATUS_COLORS[request.status] || "bg-gray-100 text-gray-800 border-gray-300 shadow-sm"}`}>
                            <StatusIcon className="h-4 w-4" />
                            {request.status.toUpperCase()}
                          </div>
                        </div>

                        {canDownload && (
                          <div className="space-y-4 border-t border-gray-100 pt-6 mt-6 transition-colors">
                            <div>
                              <label className="block text-sm font-bold text-gray-700 mb-3">
                                Decryption Key
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="password"
                                  placeholder="Enter decryption key"
                                  value={key}
                                  onChange={(e) =>
                                    setKeyByRequestId((prev) => ({
                                      ...prev,
                                      [request.id]: e.target.value,
                                    }))
                                  }
                                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:border-transparent transition-colors shadow-sm"
                                />
                                <button
                                  type="button"
                                  disabled={!key || isActive}
                                  onClick={() => handleDecryptAndDownload(request)}
                                  className="flex items-center gap-2 rounded-lg bg-sorsuMaroon px-5 py-2.5 font-bold text-white hover:bg-maroon-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-maroon-900/20 active:scale-95"
                                >
                                  {isActive ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                  Download
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
