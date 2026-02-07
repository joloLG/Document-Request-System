"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Calendar, RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle, Search, Upload, ShieldCheck, Mail, Phone, BookOpen, Clock, CheckSquare, Square, FileLock, ChevronLeft, ExternalLink, Copy, Key, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import RegistrarNavigation from "../components/RegistrarNavigation";

import { supabase } from "@/app/lib/supabaseClient";
import { encryptAesGcm, uint8ToBase64 } from "@/app/lib/aesGcm";
import { useRealtimeDocumentRequests } from "@/app/lib/realtime";

type RequestRow = {
  id: string;
  user_id: string;
  document_type: string;
  status: string;
  created_at: string;
  year_level: string | null;
  verification_url: string | null;
  encrypted_file_bucket: string | null;
  encrypted_file_path: string | null;
  original_file_name: string | null;
  decryption_key: string | null;
  profiles: {
    full_name: string;
    email_address: string;
    student_id: string;
    course_program: string | null;
    contact_number: string | null;
  } | null;
};

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

function generatePassphrase(length = 24): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";

  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }

  return out;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function RegistrarDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [requests, setRequests] = useState<RequestRow[]>([]);

  const [selectedRequestId, setSelectedRequestId] = useState("");
  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  const [statusToSet, setStatusToSet] = useState("On Process");
  const [cancellationReason, setCancellationReason] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [statusAfterUpload, setStatusAfterUpload] = useState("Completed");
  const [decryptionKey, setDecryptionKey] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Bulk operations state
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Filter requests based on search term
  const filteredRequests = useMemo(() => {
    return requests.filter((r) =>
      r.document_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.profiles?.student_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [requests, searchTerm]);

  const fetchRequests = async () => {
    setError(null);

    interface RegistrarViewRow {
      id: string;
      user_id: string;
      document_type: string;
      year_level: string | null;
      verification_url: string | null;
      status: string;
      cancellation_reason: string | null;
      encrypted_file_bucket: string | null;
      encrypted_file_path: string | null;
      original_file_name: string | null;
      original_mime_type: string | null;
      decryption_key: string | null;
      school_id: string;
      full_name: string;
      email_address: string;
      course_program: string | null;
      contact_number: string | null;
      created_at: string;
    }

    const { data, error: reqError } = await supabase
      .from("registrar_requests_view")
      .select("*")
      .order("created_at", { ascending: false });

    if (reqError) {
      setError(reqError.message);
      return;
    }

    const transformedData = (data as RegistrarViewRow[] || []).map((row) => ({
      ...row,
      student_id: row.school_id,
      profiles: {
        full_name: row.full_name,
        email_address: row.email_address,
        student_id: row.school_id,
        course_program: row.course_program,
        contact_number: row.contact_number,
      },
    }));

    setRequests((transformedData as RequestRow[]) ?? []);
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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (profile?.role !== "registrar") {
        router.push("/student/home");
        return;
      }

      await fetchRequests();
      setLoading(false);
    };

    void init();
  }, [router]);

  // Real-time subscription for new requests and status updates
  useRealtimeDocumentRequests(
    '', // No user ID filter for registrars - they see all requests
    'registrar',
    (newRequest) => {
      // For new requests from real-time, we need to fetch the profile information
      // since the requests table only contains user_id, not profile details
      const transformedRequest: RequestRow = {
        id: newRequest.id,
        user_id: newRequest.user_id,
        document_type: newRequest.document_type,
        status: newRequest.status,
        created_at: newRequest.created_at,
        year_level: newRequest.year_level,
        verification_url: newRequest.verification_url,
        encrypted_file_bucket: newRequest.encrypted_file_bucket,
        encrypted_file_path: newRequest.encrypted_file_path,
        original_file_name: newRequest.original_file_name,
        decryption_key: newRequest.decryption_key,
        profiles: null, // Will be populated by the existing fetchRequests logic
      };
      
      // Add new request to the list
      setRequests(prevRequests => [transformedRequest, ...prevRequests]);
      setSuccessMessage(`New request received: ${newRequest.document_type}`);
      setTimeout(() => setSuccessMessage(null), 5000);
      
      // Optionally trigger a full refresh to get profile information
      setTimeout(() => fetchRequests(), 1000);
    },
    (updatedRequest) => {
      // Update the specific request in the list
      setRequests(prevRequests => 
        prevRequests.map(req => 
          req.id === updatedRequest.id 
            ? { ...req, status: updatedRequest.status }
            : req
        ) as RequestRow[]
      );
    }
  );

  // Update decryption key when selected request changes
  useEffect(() => {
    if (selectedRequest) {
      setDecryptionKey(selectedRequest.decryption_key || "");
    } else {
      setDecryptionKey("");
    }
  }, [selectedRequest]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextFile = e.target.files?.[0] ?? null;
    setFile(nextFile);
  };

  const handleGenerateKey = async () => {
    const newKey = generatePassphrase();
    setDecryptionKey(newKey);
    setSuccessMessage(null);

    if (selectedRequestId) {
      setIsSavingKey(true);
      try {
        const { error: updateError } = await supabase
          .from("requests")
          .update({ decryption_key: newKey })
          .eq("id", selectedRequestId);

        if (updateError) throw updateError;
        
        // Update local state to reflect change immediately
        setRequests(prev => prev.map(r => 
          r.id === selectedRequestId ? { ...r, decryption_key: newKey } : r
        ));
      } catch (err) {
        console.error("Failed to save decryption key:", err);
        setError("Failed to auto-save decryption key.");
      } finally {
        setIsSavingKey(false);
      }
    }
  };

  const handleKeyChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setDecryptionKey(newKey);
    
    // Auto-save key if request is selected
    if (selectedRequestId) {
      try {
        await supabase
          .from("requests")
          .update({ decryption_key: newKey })
          .eq("id", selectedRequestId);
          
        // Update local state
        setRequests(prev => prev.map(r => 
          r.id === selectedRequestId ? { ...r, decryption_key: newKey } : r
        ));
      } catch (err) {
        console.error("Failed to auto-save key:", err);
      }
    }
  };

  const handleCopyKey = async () => {
    if (!decryptionKey) return;
    await navigator.clipboard.writeText(decryptionKey);
    setSuccessMessage("Decryption key copied.");
  };

  const sendEmailNotification = async (to: string, subject: string, html: string) => {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html }),
      });
    } catch (e) {
      console.error("Failed to send email", e);
    }
  };

  // Bulk operations handlers
  const handleSelectRequest = (requestId: string) => {
    setSelectedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedRequests.size === filteredRequests.length) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set(filteredRequests.map(r => r.id)));
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkAction || selectedRequests.size === 0) return;
    
    setBulkUpdating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: updateError } = await supabase
        .from("requests")
        .update({ status: bulkAction })
        .in("id", Array.from(selectedRequests));

      if (updateError) throw updateError;

      // Send notifications to all affected users
      const affectedRequests = requests.filter(r => selectedRequests.has(r.id));
      for (const request of affectedRequests) {
        const message = `Your request for ${request.document_type} is now '${bulkAction}'.`;
        
        await supabase.from("notifications").insert({
          user_id: request.user_id,
          message,
        });

        if (request.profiles?.email_address) {
          const subject = `Document Request Update: ${request.document_type}`;
          const html = `
            <p>Dear ${request.profiles.full_name},</p>
            <p>Your request for <strong>${request.document_type}</strong> is now <strong>${bulkAction}</strong>.</p>
            <p>Please log in to the Student Portal for more details.</p>
          `;
          await sendEmailNotification(request.profiles.email_address, subject, html);
        }
      }

      setSuccessMessage(`Updated ${selectedRequests.size} requests to '${bulkAction}'`);
      setSelectedRequests(new Set());
      setBulkAction("");
      setShowBulkActions(false);
      await fetchRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleUpdateStatus = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!selectedRequest) {
      setError("Please select a request.");
      return;
    }

    if (statusToSet === "Cancelled" && !cancellationReason.trim()) {
      setError("Please provide a cancellation reason.");
      return;
    }

    setUpdatingStatus(true);

    try {
      const nextCancellationReason =
        statusToSet === "Cancelled" ? cancellationReason.trim() : null;

      const { error: updateError } = await supabase
        .from("requests")
        .update({
          status: statusToSet,
          cancellation_reason: nextCancellationReason,
        })
        .eq("id", selectedRequest.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const messageBase = `Your request for ${selectedRequest.document_type} is now '${statusToSet}'.`;
      const message = nextCancellationReason
        ? `${messageBase} Reason: ${nextCancellationReason}`
        : messageBase;

      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: selectedRequest.user_id,
        message,
      });

      if (notifError) {
        throw new Error(notifError.message);
      }

      setSuccessMessage("Status updated.");

      // Send email notification
      if (selectedRequest.profiles?.email_address) {
        const subject = `Document Request Update: ${selectedRequest.document_type}`;
        const html = `
          <p>Dear ${selectedRequest.profiles.full_name},</p>
          <p>Your request for <strong>${selectedRequest.document_type}</strong> is now <strong>${statusToSet}</strong>.</p>
          ${
            nextCancellationReason
              ? `<p><strong>Reason:</strong> ${nextCancellationReason}</p>`
              : ""
          }
          <p>Please log in to the Student Portal for more details.</p>
        `;
        void sendEmailNotification(selectedRequest.profiles.email_address, subject, html);
      }

      await fetchRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUploadEncryptedDocument = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!selectedRequest) {
      setError("Please select a request.");
      return;
    }

    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }

    if (!decryptionKey) {
      setError("Please enter or generate a decryption key.");
      return;
    }

    setUploading(true);

    try {
      const fileBytes = await file.arrayBuffer();
      const enc = await encryptAesGcm(fileBytes, decryptionKey);

      const fileNameSafe = sanitizeFileName(file.name);
      const objectPath = `requests/${selectedRequest.id}/${Date.now()}-${fileNameSafe}.enc`;
      const encryptedBlob = new Blob([enc.ciphertext as BlobPart], {
        type: "application/octet-stream",
      });

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(objectPath, encryptedBlob, {
          contentType: "application/octet-stream",
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { error: updateError } = await supabase
        .from("requests")
        .update({
          status: statusAfterUpload,
          encrypted_file_bucket: "documents",
          encrypted_file_path: objectPath,
          encryption_alg: enc.algorithm,
          encryption_iv: uint8ToBase64(enc.iv),
          encryption_salt: uint8ToBase64(enc.salt),
          encryption_iterations: enc.iterations,
          decryption_key: decryptionKey,
          original_file_name: file.name,
          original_mime_type: file.type || null,
          original_size_bytes: file.size,
          uploaded_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: selectedRequest.user_id,
        message: "Your requested document is available for download.",
      });

      if (notifError) {
        throw new Error(notifError.message);
      }

      setFile(null);
      setSuccessMessage("Encrypted document uploaded successfully.");

      // Send email notification
      if (selectedRequest.profiles?.email_address) {
        const subject = `Document Available: ${selectedRequest.document_type}`;
        const html = `
          <p>Dear ${selectedRequest.profiles.full_name},</p>
          <p>Your requested document <strong>${selectedRequest.document_type}</strong> has been uploaded and is ready for download.</p>
          <p>Please log in to the Student Portal to access it.</p>
        `;
        void sendEmailNotification(selectedRequest.profiles.email_address, subject, html);
      }

      await fetchRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const StatusIcon = selectedRequest ? STATUS_ICONS[selectedRequest.status] || AlertCircle : AlertCircle;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col transition-colors duration-300">
      {/* Navigation Header */}
      <RegistrarNavigation />

      <main className="flex-1 overflow-hidden max-w-[1600px] mx-auto w-full flex flex-col md:flex-row">
        {loading ? (
          <div className="flex h-full w-full flex-col items-center justify-center p-10">
            <Loader2 className="h-8 w-8 animate-spin text-sorsuMaroon" />
            <p className="mt-4 text-sm text-gray-600">Loading dashboard...</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {/* Left Column: Request List */}
            <div className={`
              ${selectedRequestId ? 'hidden md:flex' : 'flex'} 
              w-full md:w-[350px] lg:w-[400px] flex-col overflow-hidden border-r border-gray-200 bg-white transition-colors duration-300
            `}>
              <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search requests or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none transition-colors"
                  />
                </div>
                
                {/* Bulk Actions Bar */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-sorsuMaroon transition-colors"
                  >
                    {selectedRequests.size === filteredRequests.length ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {selectedRequests.size === filteredRequests.length ? 'Deselect All' : 'Select All'}
                  </button>
                  
                  {selectedRequests.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">
                        {selectedRequests.size} selected
                      </span>
                      <button
                        onClick={() => setShowBulkActions(!showBulkActions)}
                        className="text-xs font-medium text-sorsuMaroon hover:underline"
                      >
                        {showBulkActions ? 'Cancel' : 'Bulk Actions'}
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Bulk Actions Panel */}
                {showBulkActions && selectedRequests.size > 0 && (
                  <div className="mt-3 p-3 bg-maroon-50 rounded-lg border border-maroon-200">
                    <div className="flex items-center gap-2 mb-2">
                      <select
                        value={bulkAction}
                        onChange={(e) => setBulkAction(e.target.value)}
                        className="flex-1 rounded border border-maroon-300 bg-white px-2 py-1.5 text-xs font-medium focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
                      >
                        <option value="">Select action...</option>
                        <option value="On Process">Mark as On Process</option>
                        <option value="Ready for Pick-up">Mark as Ready for Pick-up</option>
                        <option value="Completed">Mark as Completed</option>
                        <option value="Cancelled">Mark as Cancelled</option>
                      </select>
                      <button
                        onClick={handleBulkStatusUpdate}
                        disabled={!bulkAction || bulkUpdating}
                        className="rounded bg-sorsuMaroon px-3 py-1.5 text-xs font-black text-white hover:bg-maroon-900 disabled:opacity-60 transition-colors"
                      >
                        {bulkUpdating ? 'Updating...' : 'Apply'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white transition-colors">
                {filteredRequests.length === 0 ? (
                  <div className="text-center py-12 px-4 text-gray-500 text-sm">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    No requests found.
                  </div>
                ) : (
                  filteredRequests.map((r) => {
                    const ItemIcon = STATUS_ICONS[r.status] || AlertCircle;
                    const isSelected = selectedRequestId === r.id;
                    const isBulkSelected = selectedRequests.has(r.id);
                    return (
                      <div
                        key={r.id}
                        className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                          isSelected
                            ? "bg-maroon-50/50 border-sorsuMaroon ring-1 ring-sorsuMaroon/10"
                            : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {/* Checkbox for bulk selection */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectRequest(r.id);
                            }}
                            className="mt-1 shrink-0"
                          >
                            {isBulkSelected ? (
                              <CheckSquare className="h-4 w-4 text-sorsuMaroon" />
                            ) : (
                              <Square className="h-4 w-4 text-gray-400 hover:text-sorsuMaroon transition-colors" />
                            )}
                          </button>
                          
                          {/* Main content */}
                          <button
                            onClick={() => {
                              setSelectedRequestId(r.id);
                              setError(null);
                              setSuccessMessage(null);
                              setDecryptionKey("");
                              setFile(null);
                            }}
                            className="flex-1 text-left"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <div>
                                <span className="font-bold text-gray-900 text-sm line-clamp-1">
                                  {r.document_type}
                                </span>
                                <span className="text-xs text-gray-600 font-medium block">
                                  {r.profiles?.full_name || "N/A"}
                                </span>
                                <span className="text-[10px] text-gray-400 block font-mono">
                                  {r.profiles?.student_id || "No ID"}
                                </span>
                              </div>
                              {r.encrypted_file_path && (
                                <FileLock className="h-3.5 w-3.5 text-sorsuMaroon shrink-0 mt-1" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                  STATUS_COLORS[r.status] || "bg-gray-100 text-gray-800 border-gray-200"
                                }`}
                              >
                                <ItemIcon className="h-3 w-3" />
                                {r.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(r.created_at).toLocaleDateString(undefined, { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Details & Actions */}
            <div className={`
              ${selectedRequestId ? 'flex' : 'hidden md:flex'} 
              flex-1 flex-col overflow-y-auto bg-gray-50/30 transition-colors duration-300
            `}>
              {selectedRequestId && (
                <div className="md:hidden p-4 bg-white border-b border-gray-200 flex items-center transition-colors">
                  <button 
                    onClick={() => setSelectedRequestId("")}
                    className="flex items-center gap-1 text-sm font-semibold text-sorsuMaroon"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back to list
                  </button>
                </div>
              )}

              <div className="p-4 md:p-6 space-y-6">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-maroon-200 bg-maroon-50 p-4 text-sm text-maroon-700 animate-in fade-in slide-in-from-top-2 transition-colors">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 animate-in fade-in slide-in-from-top-2 transition-colors">
                    <CheckCircle className="h-5 w-5 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {!selectedRequest ? (
                  <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
                    <div className="h-20 w-20 rounded-full bg-white flex items-center justify-center shadow-sm mb-4 border border-gray-100">
                      <FileText className="h-10 w-10 opacity-20" />
                    </div>
                    <p className="text-lg font-bold text-gray-900">Select a request</p>
                    <p className="text-sm">Choose a document request from the list to manage it.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Header Info Card */}
                    <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden transition-colors duration-300">
                      <div className="bg-sorsuMaroon h-2 w-full"></div>
                      <div className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
                          <div>
                            <div className="flex items-center gap-2 text-xs font-bold text-sorsuMaroon uppercase tracking-wider mb-2">
                              <FileText className="h-4 w-4" /> Request Details
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 mb-1">
                              {selectedRequest.document_type}
                            </h2>
                            <div className="flex items-center gap-2 text-sm text-gray-500 font-mono">
                              <span className="bg-gray-100 px-2 py-0.5 rounded">ID: {selectedRequest.id.slice(0, 8)}...</span>
                              <span>•</span>
                              <span>{new Date(selectedRequest.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                          <span
                            className={`inline-flex self-start items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold border shadow-sm ${
                              STATUS_COLORS[selectedRequest.status] ||
                              "bg-gray-100 text-gray-800 border-gray-200"
                            }`}
                          >
                            <StatusIcon className="h-4 w-4" />
                            {selectedRequest.status}
                          </span>
                        </div>

                        {/* Student Information Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 bg-gray-50 rounded-xl border border-gray-100 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              <User className="h-3 w-3" /> Full Name
                            </div>
                            <p className="text-sm font-bold text-gray-900">
                              {selectedRequest.profiles?.full_name || "N/A"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              <Mail className="h-3 w-3" /> Email
                            </div>
                            <p className="text-sm font-medium text-gray-600 truncate">
                              {selectedRequest.profiles?.email_address || "N/A"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              <BookOpen className="h-3 w-3" /> Course & Year
                            </div>
                            <p className="text-sm font-medium text-gray-600">
                              {selectedRequest.profiles?.course_program || "N/A"} 
                              {selectedRequest.year_level && ` (${selectedRequest.year_level})`}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              <Phone className="h-3 w-3" /> Contact
                            </div>
                            <p className="text-sm font-medium text-gray-600">
                              {selectedRequest.profiles?.contact_number || "N/A"}
                            </p>
                          </div>
                        </div>

                        {selectedRequest.verification_url && (
                          <div className="mt-4">
                            <button 
                              onClick={async () => {
                                if (selectedRequest.verification_url) {
                                  const parts = selectedRequest.verification_url.split("/");
                                  if (parts.length >= 2) {
                                    const bucket = parts[0];
                                    const path = parts.slice(1).join("/");
                                    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
                                    if (data?.signedUrl) {
                                      window.open(data.signedUrl, "_blank");
                                    }
                                  }
                                }
                              }}
                              className="inline-flex items-center gap-2 text-xs font-bold text-sorsuMaroon hover:underline bg-maroon-50 px-3 py-2 rounded-lg transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> View Verification Link/Document
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Status Update Form */}
                      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 transition-colors">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-sorsuMaroon" /> Update Status
                        </h3>
                        <form onSubmit={handleUpdateStatus} className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                              New Status
                            </label>
                            <select
                              value={statusToSet}
                              onChange={(e) => setStatusToSet(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2.5 text-sm font-semibold focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none transition-colors"
                            >
                              <option value="Pending">Pending</option>
                              <option value="On Process">On Process</option>
                              <option value="Ready for Pick-up">Ready for Pick-up</option>
                              <option value="Completed">Completed</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </div>

                          {statusToSet === "Cancelled" && (
                            <div className="animate-in slide-in-from-top-2">
                              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                                Reason for Cancellation
                              </label>
                              <textarea
                                value={cancellationReason}
                                onChange={(e) => setCancellationReason(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2.5 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none min-h-[80px] transition-colors"
                                placeholder="e.g., Missing requirements, please re-upload..."
                              />
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={updatingStatus}
                            className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-black text-white hover:bg-black disabled:opacity-60 transition-all shadow-sm"
                          >
                            {updatingStatus ? (
                              <div className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" /> Updating...
                              </div>
                            ) : "Update Request Status"}
                          </button>
                        </form>
                      </div>

                      {/* File Upload Form */}
                      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 transition-colors">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-sorsuMaroon" /> Secure Upload
                        </h3>
                        <form onSubmit={handleUploadEncryptedDocument} className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                              Select Document
                            </label>
                            <div className="relative">
                              <input
                                type="file"
                                onChange={handleFileChange}
                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-maroon-50 file:text-sorsuMaroon hover:file:bg-maroon-100 border border-gray-200 rounded-lg cursor-pointer bg-gray-50/50 p-1 transition-colors"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                              Encryption Key
                            </label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Key className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                                <input
                                  type="text"
                                  value={decryptionKey}
                                  onChange={handleKeyChange}
                                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 pl-9 pr-3 py-2.5 text-sm font-mono focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none transition-colors"
                                  placeholder="Generate key..."
                                />
                                {isSavingKey && (
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={handleGenerateKey}
                                className="p-2.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors shadow-sm"
                                title="Generate New Key"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={handleCopyKey}
                                className="p-2.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors shadow-sm"
                                title="Copy Key"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                              Post-Upload Status
                            </label>
                            <select
                              value={statusAfterUpload}
                              onChange={(e) => setStatusAfterUpload(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2.5 text-sm font-semibold focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none transition-colors"
                            >
                              <option value="Completed">Completed</option>
                              <option value="Ready for Pick-up">Ready for Pick-up</option>
                              <option value="On Process">On Process</option>
                            </select>
                          </div>

                          <button
                            type="submit"
                            disabled={uploading}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-sorsuMaroon px-4 py-3 text-sm font-black text-white hover:bg-maroon-900 disabled:opacity-60 transition-all shadow-md shadow-sorsuMaroon/10"
                          >
                            {uploading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4" /> Encrypt & Upload
                              </>
                            )}
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Secure File Info */}
                    {selectedRequest.encrypted_file_path && (
                      <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex items-center gap-4 animate-in fade-in zoom-in-95 transition-colors">
                        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 shadow-inner">
                          <FileLock className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-green-900">
                            Secure Document Uploaded
                          </p>
                          <p className="text-xs text-green-700 font-medium">
                            {selectedRequest.original_file_name} • {new Date(selectedRequest.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="ml-auto">
                          <ShieldCheck className="h-5 w-5 text-green-500" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
