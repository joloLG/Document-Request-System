"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, Download, Loader2, CheckCircle, AlertCircle, Plus, Trash2, Edit, Eye, Search, Save, XCircle, EyeOff } from "lucide-react";
import RegistrarNavigation from "../components/RegistrarNavigation";

import { supabase } from "@/app/lib/supabaseClient";

type DocumentTemplate = {
  id: string;
  name: string;
  description: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
};

export default function RegistrarTemplatesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  const fetchTemplates = useCallback(async () => {
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

      // Fetch templates
      const { data: templatesData, error: templateError } = await supabase
        .from("document_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (templateError) throw templateError;

      setTemplates(templatesData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      let filePath = null;
      let fileName = null;
      let fileSize = null;
      let mimeType = null;

      // Upload file if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileNameSafe = `${formData.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExt}`;
        filePath = `templates/${fileNameSafe}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        fileName = file.name;
        fileSize = file.size;
        mimeType = file.type;
      }

      // Create template record
      const { error: insertError } = await supabase
        .from("document_templates")
        .insert({
          name: formData.name,
          description: formData.description || null,
          file_path: filePath,
          file_name: fileName,
          file_size: fileSize,
          mime_type: mimeType,
          is_active: formData.is_active,
          created_by: user.id,
        });

      if (insertError) throw insertError;

      setSuccessMessage("Template created successfully!");
      setShowCreateForm(false);
      setFormData({ name: "", description: "", is_active: true });
      setFile(null);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    setError(null);
    setSuccessMessage(null);
    setUploading(true);

    try {
      const updates: Partial<DocumentTemplate> = {
        name: formData.name,
        description: formData.description || null,
        is_active: formData.is_active,
      };

      // Upload new file if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileNameSafe = `${formData.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExt}`;
        const filePath = `templates/${fileNameSafe}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        updates.file_path = filePath;
        updates.file_name = file.name;
        updates.file_size = file.size;
        updates.mime_type = file.type;
      }

      const { error: updateError } = await supabase
        .from("document_templates")
        .update(updates)
        .eq("id", editingTemplate.id);

      if (updateError) throw updateError;

      setSuccessMessage("Template updated successfully!");
      setEditingTemplate(null);
      setFormData({ name: "", description: "", is_active: true });
      setFile(null);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update template");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template? This action cannot be undone.")) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      const { error: deleteError } = await supabase
        .from("document_templates")
        .delete()
        .eq("id", templateId);

      if (deleteError) throw deleteError;

      setSuccessMessage("Template deleted successfully!");
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  const handleToggleActive = async (templateId: string, isActive: boolean) => {
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: updateError } = await supabase
        .from("document_templates")
        .update({ is_active: isActive })
        .eq("id", templateId);

      if (updateError) throw updateError;

      setSuccessMessage(`Template ${isActive ? 'activated' : 'deactivated'} successfully!`);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update template status");
    }
  };

  const handleDownloadTemplate = async (template: DocumentTemplate) => {
    if (!template.file_path) return;

    try {
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(template.file_path, 3600);

      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = template.file_name || 'template';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download template");
    }
  };

  const startEdit = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      is_active: template.is_active,
    });
    setFile(null);
  };

  const cancelEdit = () => {
    setEditingTemplate(null);
    setShowCreateForm(false);
    setFormData({ name: "", description: "", is_active: true });
    setFile(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-sorsuMaroon mx-auto mb-4" />
          <p className="text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <RegistrarNavigation />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between gap-3 max-w-[1600px] mx-auto w-full">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-sorsuMaroon" />
            <h1 className="text-xl font-bold text-gray-900">Document Templates</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/registrar/dashboard")}
              className="text-sm font-medium text-gray-600 hover:text-sorsuMaroon transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 rounded-lg bg-sorsuMaroon px-4 py-2 text-sm font-black text-white hover:bg-maroon-900 transition-colors"
            >
              <Plus className="h-4 w-4" /> New Template
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

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
            />
          </div>
        </div>

        {/* Create/Edit Form */}
        {(showCreateForm || editingTemplate) && (
          <div className="mb-6 rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h2>
            <form onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
                    placeholder="e.g., Transcript of Records Template"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template File
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-maroon-50 file:text-sorsuMaroon hover:file:bg-maroon-100 border border-gray-200 rounded-lg cursor-pointer bg-gray-50/50 p-1"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none min-h-[80px]"
                  placeholder="Describe the template purpose and usage..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-sorsuMaroon focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active (available for use)
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-lg bg-sorsuMaroon px-4 py-2 text-sm font-black text-white hover:bg-maroon-900 disabled:opacity-60 transition-colors"
                >
                  {uploading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {editingTemplate ? 'Updating...' : 'Creating...'}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      {editingTemplate ? 'Update Template' : 'Create Template'}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Templates List */}
        <div className="grid gap-4">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first template'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-sorsuMaroon px-4 py-2 text-sm font-black text-white hover:bg-maroon-900 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Create Template
                </button>
              )}
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <div key={template.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
                          template.is_active
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}
                      >
                        {template.is_active ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" />
                            Inactive
                          </>
                        )}
                      </span>
                    </div>
                    
                    {template.description && (
                      <p className="text-gray-600 text-sm mb-3">{template.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Created {new Date(template.created_at).toLocaleDateString()}</span>
                      {template.file_name && (
                        <span>File: {template.file_name}</span>
                      )}
                      {template.file_size && (
                        <span>Size: {(template.file_size / 1024).toFixed(1)} KB</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {template.file_path && (
                      <button
                        onClick={() => handleDownloadTemplate(template)}
                        className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                        title="Download template"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleActive(template.id, !template.is_active)}
                      className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                      title={template.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {template.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => startEdit(template)}
                      className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                      title="Edit template"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-2 rounded-lg border border-red-300 bg-white hover:bg-red-50 text-red-700 transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
