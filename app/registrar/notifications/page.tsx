"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Mail,
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search,
  RefreshCw,
} from "lucide-react";

import { supabase } from "@/app/lib/supabaseClient";

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  template_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
};

type NotificationPreference = {
  id: string;
  user_id: string;
  email_notifications: boolean;
  in_app_notifications: boolean;
  request_updates: boolean;
  document_ready: boolean;
  status_changes: boolean;
  system_announcements: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    email_address: string;
    student_id: string;
  };
};

export default function RegistrarNotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'preferences'>('templates');
  
  // Email Templates State
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateTemplateForm, setShowCreateTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  
  // Notification Preferences State
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [updatingPreferences, setUpdatingPreferences] = useState(false);
  
  // Form State
  const [templateForm, setTemplateForm] = useState({
    name: "",
    subject: "",
    html_content: "",
    template_type: "request_update",
    is_active: true,
  });

  const templateTypes = [
    { value: "request_update", label: "Request Status Update" },
    { value: "document_ready", label: "Document Ready for Download" },
    { value: "verification_approved", label: "Verification Approved" },
    { value: "verification_rejected", label: "Verification Rejected" },
    { value: "welcome", label: "Welcome Email" },
    { value: "system_announcement", label: "System Announcement" },
  ];

  const fetchEmailTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error("Failed to fetch email templates:", err);
    }
  }, []);

  const fetchNotificationPreferences = useCallback(async () => {
    setLoadingPreferences(true);
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select(`
          *,
          profiles!inner(
            full_name,
            email_address,
            student_id
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPreferences(data || []);
    } catch (err) {
      console.error("Failed to fetch notification preferences:", err);
    } finally {
      setLoadingPreferences(false);
    }
  }, []);

  const initializeData = useCallback(async () => {
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

      await Promise.all([
        fetchEmailTemplates(),
        fetchNotificationPreferences(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [router, fetchEmailTemplates, fetchNotificationPreferences]);

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.template_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTemplate(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error: insertError } = await supabase
        .from("email_templates")
        .insert({
          ...templateForm,
          created_by: user.id,
        });

      if (insertError) throw insertError;

      setSuccessMessage("Email template created successfully!");
      setShowCreateTemplateForm(false);
      setTemplateForm({
        name: "",
        subject: "",
        html_content: "",
        template_type: "request_update",
        is_active: true,
      });
      await fetchEmailTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    setSavingTemplate(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: updateError } = await supabase
        .from("email_templates")
        .update({
          name: templateForm.name,
          subject: templateForm.subject,
          html_content: templateForm.html_content,
          template_type: templateForm.template_type,
          is_active: templateForm.is_active,
        })
        .eq("id", editingTemplate.id);

      if (updateError) throw updateError;

      setSuccessMessage("Email template updated successfully!");
      setEditingTemplate(null);
      setTemplateForm({
        name: "",
        subject: "",
        html_content: "",
        template_type: "request_update",
        is_active: true,
      });
      await fetchEmailTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this email template? This action cannot be undone.")) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      const { error: deleteError } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", templateId);

      if (deleteError) throw deleteError;

      setSuccessMessage("Email template deleted successfully!");
      await fetchEmailTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  const handleToggleTemplate = async (templateId: string, isActive: boolean) => {
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: updateError } = await supabase
        .from("email_templates")
        .update({ is_active: isActive })
        .eq("id", templateId);

      if (updateError) throw updateError;

      setSuccessMessage(`Template ${isActive ? 'activated' : 'deactivated'} successfully!`);
      await fetchEmailTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update template status");
    }
  };

  const handleUpdateUserPreferences = async (userId: string, updates: Partial<NotificationPreference>) => {
    setUpdatingPreferences(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: updateError } = await supabase
        .from("notification_preferences")
        .update(updates)
        .eq("user_id", userId);

      if (updateError) throw updateError;

      setSuccessMessage("Notification preferences updated successfully!");
      await fetchNotificationPreferences();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update preferences");
    } finally {
      setUpdatingPreferences(false);
    }
  };

  const startEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      html_content: template.html_content,
      template_type: template.template_type,
      is_active: template.is_active,
    });
  };

  const cancelEdit = () => {
    setEditingTemplate(null);
    setShowCreateTemplateForm(false);
    setTemplateForm({
      name: "",
      subject: "",
      html_content: "",
      template_type: "request_update",
      is_active: true,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-sorsuMaroon mx-auto mb-4" />
          <p className="text-gray-600">Loading notification settings...</p>
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
            <Bell className="h-6 w-6 text-sorsuMaroon" />
            <h1 className="text-xl font-bold text-gray-900">Notification Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/registrar/dashboard")}
              className="text-sm font-medium text-gray-600 hover:text-sorsuMaroon transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={initializeData}
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

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'templates'
                  ? 'border-sorsuMaroon text-sorsuMaroon'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Templates
              </div>
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'preferences'
                  ? 'border-sorsuMaroon text-sorsuMaroon'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                User Preferences
              </div>
            </button>
          </nav>
        </div>

        {activeTab === 'templates' && (
          <div className="space-y-6">
            {/* Search and Create */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
                />
              </div>
              <button
                onClick={() => setShowCreateTemplateForm(true)}
                className="flex items-center gap-2 rounded-lg bg-sorsuMaroon px-4 py-2 text-sm font-black text-white hover:bg-maroon-900 transition-colors"
              >
                <Plus className="h-4 w-4" /> New Template
              </button>
            </div>

            {/* Create/Edit Template Form */}
            {(showCreateTemplateForm || editingTemplate) && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  {editingTemplate ? 'Edit Email Template' : 'Create New Email Template'}
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
                        value={templateForm.name}
                        onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
                        placeholder="e.g., Request Status Update"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Template Type *
                      </label>
                      <select
                        value={templateForm.template_type}
                        onChange={(e) => setTemplateForm({ ...templateForm, template_type: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
                      >
                        {templateTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Subject *
                    </label>
                    <input
                      type="text"
                      required
                      value={templateForm.subject}
                      onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
                      placeholder="e.g., Your Document Request Status Has Been Updated"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      HTML Content *
                    </label>
                    <textarea
                      required
                      value={templateForm.html_content}
                      onChange={(e) => setTemplateForm({ ...templateForm, html_content: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none min-h-[200px]"
                      placeholder="<p>Dear {{name}},</p><p>Your request for {{document_type}} is now {{status}}.</p>"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Available variables: {`{{name}}, {{document_type}}, {{status}}, {{student_id}}, {{email}}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={templateForm.is_active}
                      onChange={(e) => setTemplateForm({ ...templateForm, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-sorsuMaroon focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                      Active (available for use)
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={savingTemplate}
                      className="rounded-lg bg-sorsuMaroon px-4 py-2 text-sm font-black text-white hover:bg-maroon-900 disabled:opacity-60 transition-colors"
                    >
                      {savingTemplate ? (
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
                  <Mail className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No email templates found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first email template'}
                  </p>
                  {!searchTerm && (
                    <button
                      onClick={() => setShowCreateTemplateForm(true)}
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
                            {template.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-2">{template.subject}</p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Type: {template.template_type.replace('_', ' ')}</span>
                          <span>Created {new Date(template.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => setPreviewTemplate(template)}
                          className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                          title="Preview template"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleTemplate(template.id, !template.is_active)}
                          className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                          title={template.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {template.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => startEditTemplate(template)}
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
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-6">
            {loadingPreferences ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Loader2 className="h-8 w-8 animate-spin text-sorsuMaroon mx-auto mb-4" />
                <p className="text-gray-600">Loading notification preferences...</p>
              </div>
            ) : preferences.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Settings className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No notification preferences found</h3>
                <p className="text-gray-600">Users haven&apos;t set up their notification preferences yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {preferences.map((pref) => (
                  <div key={pref.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {pref.profiles?.full_name || 'Unknown User'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {pref.profiles?.email_address} • {pref.profiles?.student_id}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pref.email_notifications}
                          onChange={(e) => handleUpdateUserPreferences(pref.user_id, { email_notifications: e.target.checked })}
                          disabled={updatingPreferences}
                          className="rounded border-gray-300 text-sorsuMaroon focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Email Notifications</div>
                          <div className="text-xs text-gray-500">Receive notifications via email</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pref.in_app_notifications}
                          onChange={(e) => handleUpdateUserPreferences(pref.user_id, { in_app_notifications: e.target.checked })}
                          disabled={updatingPreferences}
                          className="rounded border-gray-300 text-sorsuMaroon focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">In-App Notifications</div>
                          <div className="text-xs text-gray-500">Show notifications in the portal</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pref.request_updates}
                          onChange={(e) => handleUpdateUserPreferences(pref.user_id, { request_updates: e.target.checked })}
                          disabled={updatingPreferences}
                          className="rounded border-gray-300 text-sorsuMaroon focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Request Updates</div>
                          <div className="text-xs text-gray-500">Status changes for document requests</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pref.document_ready}
                          onChange={(e) => handleUpdateUserPreferences(pref.user_id, { document_ready: e.target.checked })}
                          disabled={updatingPreferences}
                          className="rounded border-gray-300 text-sorsuMaroon focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Document Ready</div>
                          <div className="text-xs text-gray-500">When documents are available</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pref.status_changes}
                          onChange={(e) => handleUpdateUserPreferences(pref.user_id, { status_changes: e.target.checked })}
                          disabled={updatingPreferences}
                          className="rounded border-gray-300 text-sorsuMaroon focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Status Changes</div>
                          <div className="text-xs text-gray-500">All status update notifications</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pref.system_announcements}
                          onChange={(e) => handleUpdateUserPreferences(pref.user_id, { system_announcements: e.target.checked })}
                          disabled={updatingPreferences}
                          className="rounded border-gray-300 text-sorsuMaroon focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">System Announcements</div>
                          <div className="text-xs text-gray-500">Important system updates</div>
                        </div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Template Preview Modal */}
        {previewTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Email Template Preview</h3>
                  <button
                    onClick={() => setPreviewTemplate(null)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Subject:</div>
                    <div className="text-gray-900">{previewTemplate.subject}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">HTML Content:</div>
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div dangerouslySetInnerHTML={{ __html: previewTemplate.html_content }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
