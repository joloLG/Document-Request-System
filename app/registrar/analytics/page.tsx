"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, Clock, CheckCircle, XCircle, Calendar, TrendingUp, Loader2, AlertCircle, Users, Download, RefreshCw } from "lucide-react";
import RegistrarNavigation from "../components/RegistrarNavigation";

import { supabase } from "@/app/lib/supabaseClient";

type AnalyticsData = {
  totalRequests: number;
  pendingRequests: number;
  onProcessRequests: number;
  readyForPickupRequests: number;
  completedRequests: number;
  cancelledRequests: number;
  averageProcessingTime: number;
  requestsThisMonth: number;
  requestsLastMonth: number;
  monthlyTrend: number;
  documentTypeStats: Array<{
    document_type: string;
    count: number;
    percentage: number;
  }>;
  dailyStats: Array<{
    date: string;
    count: number;
    completed: number;
  }>;
};

export default function RegistrarAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState("30"); // days

  const fetchAnalytics = useCallback(async () => {
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

      // Fetch requests data
      const { data: requests, error: reqError } = await supabase
        .from("requests")
        .select("*")
        .gte("created_at", dateFilter)
        .order("created_at", { ascending: false });

      if (reqError) throw reqError;

      // Calculate analytics
      const totalRequests = requests?.length || 0;
      const pendingRequests = requests?.filter(r => r.status === "Pending").length || 0;
      const onProcessRequests = requests?.filter(r => r.status === "On Process").length || 0;
      const readyForPickupRequests = requests?.filter(r => r.status === "Ready for Pick-up").length || 0;
      const completedRequests = requests?.filter(r => r.status === "Completed").length || 0;
      const cancelledRequests = requests?.filter(r => r.status === "Cancelled").length || 0;

      // Calculate average processing time (in days)
      const completedRequestsData = requests?.filter(r => r.status === "Completed" && r.updated_at) || [];
      const processingTimes = completedRequestsData.map(r => {
        const created = new Date(r.created_at);
        const updated = new Date(r.updated_at);
        return (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
      });
      const averageProcessingTime = processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
        : 0;

      // Monthly comparison
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      lastMonth.setDate(1);

      const requestsThisMonth = requests?.filter(r => new Date(r.created_at) >= thisMonth).length || 0;
      const requestsLastMonth = requests?.filter(r => {
        const date = new Date(r.created_at);
        return date >= lastMonth && date < thisMonth;
      }).length || 0;

      const monthlyTrend = requestsLastMonth > 0 
        ? ((requestsThisMonth - requestsLastMonth) / requestsLastMonth) * 100 
        : 0;

      // Document type statistics
      const documentTypeMap = new Map<string, number>();
      requests?.forEach(r => {
        documentTypeMap.set(r.document_type, (documentTypeMap.get(r.document_type) || 0) + 1);
      });

      const documentTypeStats = Array.from(documentTypeMap.entries())
        .map(([type, count]) => ({
          document_type: type,
          count,
          percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count);

      // Daily statistics for the last 14 days
      const dailyStats = [];
      for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayRequests = requests?.filter(r => {
          const reqDate = new Date(r.created_at);
          return reqDate >= date && reqDate < nextDate;
        }) || [];

        const dayCompleted = dayRequests.filter(r => r.status === "Completed").length;

        dailyStats.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: dayRequests.length,
          completed: dayCompleted
        });
      }

      setAnalytics({
        totalRequests,
        pendingRequests,
        onProcessRequests,
        readyForPickupRequests,
        completedRequests,
        cancelledRequests,
        averageProcessingTime,
        requestsThisMonth,
        requestsLastMonth,
        monthlyTrend,
        documentTypeStats,
        dailyStats
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [dateRange, router]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, fetchAnalytics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-sorsuMaroon mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <RegistrarNavigation />

      {/* Analytics Controls */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between gap-3 max-w-[1600px] mx-auto w-full">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Analytics Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
            <button
              onClick={fetchAnalytics}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6">
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {analytics && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    analytics.monthlyTrend >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {analytics.monthlyTrend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingUp className="h-4 w-4 rotate-180" />}
                    {Math.abs(analytics.monthlyTrend).toFixed(1)}%
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{analytics.totalRequests}</h3>
                <p className="text-sm text-gray-600">Total Requests</p>
                <p className="text-xs text-gray-500 mt-1">{analytics.requestsThisMonth} this month</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{analytics.pendingRequests + analytics.onProcessRequests}</h3>
                <p className="text-sm text-gray-600">Pending/Processing</p>
                <p className="text-xs text-gray-500 mt-1">{analytics.pendingRequests} pending, {analytics.onProcessRequests} processing</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{analytics.completedRequests}</h3>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-xs text-gray-500 mt-1">{analytics.averageProcessingTime.toFixed(1)} days avg. processing</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{analytics.cancelledRequests}</h3>
                <p className="text-sm text-gray-600">Cancelled</p>
                <p className="text-xs text-gray-500 mt-1">{analytics.totalRequests > 0 ? ((analytics.cancelledRequests / analytics.totalRequests) * 100).toFixed(1) : 0}% cancellation rate</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Trend Chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-sorsuMaroon" />
                  Daily Request Trend (14 days)
                </h3>
                <div className="space-y-2">
                  {analytics.dailyStats.map((day, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-16 text-xs text-gray-600 font-medium">{day.date}</div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                          <div 
                            className="absolute left-0 top-0 h-full bg-sorsuMaroon rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((day.count / Math.max(...analytics.dailyStats.map(d => d.count))) * 100, 100)}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                            {day.count}
                          </span>
                        </div>
                        {day.completed > 0 && (
                          <div className="w-12 text-xs text-green-600 font-medium">
                            ✓{day.completed}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Document Type Distribution */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-sorsuMaroon" />
                  Document Type Distribution
                </h3>
                <div className="space-y-3">
                  {analytics.documentTypeStats.slice(0, 8).map((doc, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-20 text-sm font-medium text-gray-900 truncate">
                          {doc.document_type}
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                          <div 
                            className="absolute left-0 top-0 h-full bg-linear-to-r from-sorsuMaroon to-maroon-600 rounded-full transition-all duration-500"
                            style={{ width: `${doc.percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="ml-3 text-sm font-bold text-gray-900 w-12 text-right">
                        {doc.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => router.push("/registrar/dashboard")}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <FileText className="h-5 w-5 text-sorsuMaroon" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">View All Requests</div>
                    <div className="text-sm text-gray-600">Manage document requests</div>
                  </div>
                </button>
                <button
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-5 w-5 text-sorsuMaroon" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Export Report</div>
                    <div className="text-sm text-gray-600">Download analytics data</div>
                  </div>
                </button>
                <button
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <Users className="h-5 w-5 text-sorsuMaroon" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Student Insights</div>
                    <div className="text-sm text-gray-600">View student statistics</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
