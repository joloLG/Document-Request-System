"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  History,
  Search,
  Filter,
  Download,
  RefreshCw,
  User,
  FileText,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  Loader2,
  Eye,
} from "lucide-react";

import { supabase } from "@/app/lib/supabaseClient";

type AuditLog = {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    email_address: string;
    student_id: string;
    role: string;
  };
};

type ActivitySummary = {
  total_actions: number;
  actions_today: number;
  actions_this_week: number;
  unique_users: number;
  top_actions: Array<{
    action: string;
    count: number;
  }>;
};

export default function RegistrarAuditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("7"); // days
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
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

      // Calculate date range
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));
      const dateFilter = daysAgo.toISOString();

      // Build query
      let query = supabase
        .from("audit_logs")
        .select(`
          *,
          profiles!inner(
            full_name,
            email_address,
            student_id,
            role
          )
        `)
        .gte("created_at", dateFilter)
        .order("created_at", { ascending: false })
        .limit(1000);

      // Apply filters
      if (actionFilter) {
        query = query.eq("action", actionFilter);
      }
      if (userFilter) {
        query = query.eq("user_id", userFilter);
      }

      const { data, error: auditError } = await query;

      if (auditError) throw auditError;

      setAuditLogs(data || []);

      // Calculate activity summary
      const totalActions = data?.length || 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const actionsToday = data?.filter(log => new Date(log.created_at) >= today).length || 0;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const actionsThisWeek = data?.filter(log => new Date(log.created_at) >= weekAgo).length || 0;

      const uniqueUsers = new Set(data?.map(log => log.user_id) || []).size;

      // Count top actions
      const actionCounts = new Map<string, number>();
      data?.forEach(log => {
        actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
      });

      const topActions = Array.from(actionCounts.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setActivitySummary({
        total_actions: totalActions,
        actions_today: actionsToday,
        actions_this_week: actionsThisWeek,
        unique_users: uniqueUsers,
        top_actions: topActions,
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [router, dateRange, actionFilter, userFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const filteredLogs = auditLogs.filter(log =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.profiles?.email_address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionIcon = (action: string) => {
    if (action.includes('CREATE') || action.includes('INSERT')) return CheckCircle;
    if (action.includes('UPDATE') || action.includes('MODIFY')) return RefreshCw;
    if (action.includes('DELETE') || action.includes('REMOVE')) return XCircle;
    if (action.includes('LOGIN') || action.includes('AUTH')) return ShieldCheck;
    if (action.includes('VIEW') || action.includes('READ')) return Eye;
    return FileText;
  };

  const getActionColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('INSERT')) return 'text-green-600 bg-green-100';
    if (action.includes('UPDATE') || action.includes('MODIFY')) return 'text-blue-600 bg-blue-100';
    if (action.includes('DELETE') || action.includes('REMOVE')) return 'text-red-600 bg-red-100';
    if (action.includes('LOGIN') || action.includes('AUTH')) return 'text-purple-600 bg-purple-100';
    if (action.includes('VIEW') || action.includes('READ')) return 'text-gray-600 bg-gray-100';
    return 'text-gray-600 bg-gray-100';
  };

  const exportAuditLogs = () => {
    const csv = [
      'Date,User,Email,Action,Entity Type,Entity ID,IP Address',
      ...filteredLogs.map(log => 
        `"${new Date(log.created_at).toLocaleString()}","${log.profiles?.full_name || 'Unknown'}","${log.profiles?.email_address || 'N/A'}","${log.action}","${log.entity_type}","${log.entity_id || 'N/A'}","${log.ip_address || 'N/A'}"`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getUniqueActions = () => {
    const actions = new Set(auditLogs.map(log => log.action));
    return Array.from(actions).sort();
  };

  const getUniqueUsers = () => {
    return auditLogs.map(log => ({
      id: log.user_id,
      name: log.profiles?.full_name || 'Unknown',
    })).filter((user, index, self) => self.findIndex(u => u.id === user.id) === index);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-sorsuMaroon mx-auto mb-4" />
          <p className="text-gray-600">Loading audit logs...</p>
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
            <History className="h-6 w-6 text-sorsuMaroon" />
            <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/registrar/dashboard")}
              className="text-sm font-medium text-gray-600 hover:text-sorsuMaroon transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={exportAuditLogs}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <button
              onClick={fetchAuditLogs}
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

        {/* Activity Summary */}
        {activitySummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{activitySummary.total_actions}</h3>
              <p className="text-sm text-gray-600">Total Actions</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{activitySummary.actions_today}</h3>
              <p className="text-sm text-gray-600">Actions Today</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{activitySummary.actions_this_week}</h3>
              <p className="text-sm text-gray-600">Actions This Week</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{activitySummary.unique_users}</h3>
              <p className="text-sm text-gray-600">Unique Users</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Filter className="h-5 w-5 text-sorsuMaroon" />
            Filters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
              >
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
              >
                <option value="">All Actions</option>
                {getUniqueActions().map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
              >
                <option value="">All Users</option>
                {getUniqueUsers().map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        {activitySummary?.top_actions && activitySummary.top_actions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Top Actions</h3>
            <div className="space-y-2">
              {activitySummary.top_actions.map((item, index) => {
                const ActionIcon = getActionIcon(item.action);
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getActionColor(item.action)}`}>
                        <ActionIcon className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-gray-900">{item.action}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-600">{item.count} times</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Audit Logs Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">Activity Log</h3>
          </div>
          <div className="overflow-x-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No audit logs found matching your criteria.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLogs.map((log) => {
                    const ActionIcon = getActionIcon(log.action);
                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {log.profiles?.full_name || 'Unknown User'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {log.profiles?.email_address}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded ${getActionColor(log.action)}`}>
                              <ActionIcon className="h-3 w-3" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{log.action}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{log.entity_type}</div>
                            {log.entity_id && (
                              <div className="text-xs text-gray-500 font-mono">{log.entity_id.slice(0, 8)}...</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {log.ip_address || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setShowDetails(showDetails === log.id ? null : log.id)}
                            className="text-sorsuMaroon hover:underline font-medium"
                          >
                            {showDetails === log.id ? 'Hide' : 'Show'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Details Modal */}
        {showDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Audit Log Details</h3>
                  <button
                    onClick={() => setShowDetails(null)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {(() => {
                  const log = filteredLogs.find(l => l.id === showDetails);
                  if (!log) return null;
                  
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-gray-500">Date & Time</div>
                          <div className="text-gray-900">{new Date(log.created_at).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-500">User</div>
                          <div className="text-gray-900">{log.profiles?.full_name}</div>
                          <div className="text-sm text-gray-500">{log.profiles?.email_address}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-500">Action</div>
                          <div className="text-gray-900">{log.action}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-500">Entity</div>
                          <div className="text-gray-900">{log.entity_type}</div>
                          {log.entity_id && (
                            <div className="text-sm text-gray-500 font-mono">{log.entity_id}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-500">IP Address</div>
                          <div className="text-gray-900 font-mono">{log.ip_address || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-500">User Agent</div>
                          <div className="text-gray-900 text-xs break-all">{log.user_agent || 'N/A'}</div>
                        </div>
                      </div>
                      
                      {log.old_values && (
                        <div>
                          <div className="text-sm font-medium text-gray-500 mb-2">Old Values</div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(log.old_values, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {log.new_values && (
                        <div>
                          <div className="text-sm font-medium text-gray-500 mb-2">New Values</div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
