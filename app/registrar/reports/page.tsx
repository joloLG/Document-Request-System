"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Download,
  Calendar,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Users,
  FileDown,
  Database,
} from "lucide-react";

import { supabase } from "@/app/lib/supabaseClient";

type ReportType = 'requests' | 'students' | 'analytics' | 'audit' | 'templates';

interface ReportConfig {
  type: ReportType;
  name: string;
  description: string;
  formats: ('csv' | 'xlsx' | 'pdf')[];
  dateRange: boolean;
  filters: string[];
}

export default function RegistrarReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportType>('requests');
  const [dateRange, setDateRange] = useState("30"); // days
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const reportConfigs: ReportConfig[] = [
    {
      type: 'requests',
      name: 'Document Requests Report',
      description: 'Comprehensive report of all document requests with status and timeline',
      formats: ['csv', 'xlsx', 'pdf'],
      dateRange: true,
      filters: ['status', 'document_type', 'course_program']
    },
    {
      type: 'students',
      name: 'Students Report',
      description: 'List of all students with their profile information and verification status',
      formats: ['csv', 'xlsx'],
      dateRange: false,
      filters: ['course_program', 'year_level', 'verification_status']
    },
    {
      type: 'analytics',
      name: 'Analytics Report',
      description: 'Statistical analysis of requests, processing times, and trends',
      formats: ['xlsx', 'pdf'],
      dateRange: true,
      filters: ['group_by', 'include_charts']
    },
    {
      type: 'audit',
      name: 'Audit Log Report',
      description: 'System activity and audit logs for compliance and security',
      formats: ['csv', 'xlsx'],
      dateRange: true,
      filters: ['user_id', 'action', 'entity_type']
    },
    {
      type: 'templates',
      name: 'Document Templates Report',
      description: 'Inventory of document templates and their usage statistics',
      formats: ['csv', 'xlsx'],
      dateRange: false,
      filters: ['is_active', 'template_type']
    }
  ];

  const currentConfig = reportConfigs.find(config => config.type === selectedReport);

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

      // Initialize filters based on selected report
      const newFilters: Record<string, string> = {};
      currentConfig?.filters.forEach(filter => {
        newFilters[filter] = '';
      });
      setFilters(newFilters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize reports");
    } finally {
      setLoading(false);
    }
  }, [router, currentConfig]);

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  const generateReport = async () => {
    setGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Prepare report parameters
      const reportParams = {
        type: selectedReport,
        format,
        dateRange: currentConfig?.dateRange ? dateRange : null,
        filters: Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value.trim() !== '')
        ),
        generatedBy: user.id,
      };

      // Call the report generation API
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportParams),
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      // Get the report data
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport}-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccessMessage("Report generated and downloaded successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-sorsuMaroon mx-auto mb-4" />
          <p className="text-gray-600">Loading reports...</p>
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
            <FileDown className="h-6 w-6 text-sorsuMaroon" />
            <h1 className="text-xl font-bold text-gray-900">Reports & Exports</h1>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Select Report Type</h2>
              <div className="space-y-3">
                {reportConfigs.map((config) => (
                  <button
                    key={config.type}
                    onClick={() => setSelectedReport(config.type)}
                    className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                      selectedReport === config.type
                        ? "bg-maroon-50 border-sorsuMaroon ring-1 ring-sorsuMaroon/10"
                        : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {config.type === 'requests' && <FileText className="h-5 w-5 text-sorsuMaroon" />}
                      {config.type === 'students' && <Users className="h-5 w-5 text-sorsuMaroon" />}
                      {config.type === 'analytics' && <BarChart3 className="h-5 w-5 text-sorsuMaroon" />}
                      {config.type === 'audit' && <Database className="h-5 w-5 text-sorsuMaroon" />}
                      {config.type === 'templates' && <FileText className="h-5 w-5 text-sorsuMaroon" />}
                      <span className="font-semibold text-gray-900">{config.name}</span>
                    </div>
                    <p className="text-sm text-gray-600">{config.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">Formats:</span>
                      {config.formats.map(fmt => (
                        <span key={fmt} className="text-xs font-medium text-sorsuMaroon uppercase">
                          {fmt}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Report Configuration */}
          <div className="lg:col-span-2">
            {currentConfig && (
              <div className="space-y-6">
                {/* Report Configuration */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Report Configuration</h2>
                  
                  {/* Format Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                    <div className="flex gap-3">
                      {currentConfig.formats.map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setFormat(fmt as 'csv' | 'xlsx' | 'pdf')}
                          className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
                            format === fmt
                              ? "bg-sorsuMaroon text-white border-sorsuMaroon"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Range */}
                  {currentConfig.dateRange && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                      <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
                      >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="365">Last year</option>
                        <option value="all">All time</option>
                      </select>
                    </div>
                  )}

                  {/* Filters */}
                  {currentConfig.filters.length > 0 && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Filters</label>
                      <div className="space-y-3">
                        {currentConfig.filters.map((filter) => (
                          <div key={filter}>
                            <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">
                              {filter.replace('_', ' ')}
                            </label>
                            <input
                              type="text"
                              value={filters[filter] || ''}
                              onChange={(e) => handleFilterChange(filter, e.target.value)}
                              placeholder={`Filter by ${filter.replace('_', ' ')}...`}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sorsuMaroon focus:ring-1 focus:ring-sorsuMaroon outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generate Button */}
                  <button
                    onClick={generateReport}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-sorsuMaroon px-6 py-3 text-sm font-black text-white hover:bg-maroon-900 disabled:opacity-60 transition-colors"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Report...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Generate & Download Report
                      </>
                    )}
                  </button>
                </div>

                {/* Report Information */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Report Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-sorsuMaroon mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">{currentConfig.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{currentConfig.description}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-500 mb-1">Available Formats</div>
                        <div className="flex gap-2">
                          {currentConfig.formats.map(fmt => (
                            <span key={fmt} className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700">
                              {fmt.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-500 mb-1">Date Range Support</div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">
                            {currentConfig.dateRange ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-2">Available Filters</div>
                      <div className="flex flex-wrap gap-2">
                        {currentConfig.filters.map(filter => (
                          <span key={filter} className="px-2 py-1 bg-maroon-50 rounded text-xs font-medium text-sorsuMaroon capitalize">
                            {filter.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => {
                        setSelectedReport('requests');
                        setDateRange('30');
                        setFormat('csv');
                      }}
                      className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                    >
                      <FileText className="h-5 w-5 text-sorsuMaroon" />
                      <div>
                        <div className="font-medium text-gray-900">Monthly Requests</div>
                        <div className="text-sm text-gray-600">Export last 30 days of requests</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReport('students');
                        setFormat('xlsx');
                      }}
                      className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                    >
                      <Users className="h-5 w-5 text-sorsuMaroon" />
                      <div>
                        <div className="font-medium text-gray-900">Student Directory</div>
                        <div className="text-sm text-gray-600">Export all student profiles</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReport('analytics');
                        setDateRange('90');
                        setFormat('xlsx');
                      }}
                      className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                    >
                      <BarChart3 className="h-5 w-5 text-sorsuMaroon" />
                      <div>
                        <div className="font-medium text-gray-900">Quarterly Analytics</div>
                        <div className="text-sm text-gray-600">Export 90-day analytics report</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReport('audit');
                        setDateRange('7');
                        setFormat('csv');
                      }}
                      className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                    >
                      <Database className="h-5 w-5 text-sorsuMaroon" />
                      <div>
                        <div className="font-medium text-gray-900">Weekly Audit Log</div>
                        <div className="text-sm text-gray-600">Export 7-day audit trail</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
