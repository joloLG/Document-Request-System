import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    // Get user and verify role
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'registrar') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { type, format, dateRange, filters } = await request.json();

    let data: unknown[] = [];
    let filename = '';

    // Fetch data based on report type
    switch (type) {
      case 'requests':
        data = await fetchRequestsData(dateRange, filters);
        filename = `document-requests-${new Date().toISOString().split('T')[0]}`;
        break;
      case 'students':
        data = await fetchStudentsData(filters);
        filename = `students-${new Date().toISOString().split('T')[0]}`;
        break;
      case 'analytics':
        data = await fetchAnalyticsData(dateRange);
        filename = `analytics-${new Date().toISOString().split('T')[0]}`;
        break;
      case 'audit':
        data = await fetchAuditData(dateRange, filters);
        filename = `audit-log-${new Date().toISOString().split('T')[0]}`;
        break;
      case 'templates':
        data = await fetchTemplatesData(filters);
        filename = `templates-${new Date().toISOString().split('T')[0]}`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }

    // Generate report based on format
    if (format === 'csv') {
      const csv = generateCSV(data, type);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    } else if (format === 'xlsx' || format === 'pdf') {
      // For now, return CSV for other formats (in production, you'd use libraries like xlsx or puppeteer)
      const csv = generateCSV(data, type);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });

  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

async function fetchRequestsData(dateRange: string | null, filters: Record<string, string>) {
  let query = supabase
    .from('registrar_requests_view')
    .select('*');

  // Apply date range filter
  if (dateRange && dateRange !== 'all') {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));
    query = query.gte('created_at', daysAgo.toISOString());
  }

  // Apply other filters
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.document_type) {
    query = query.ilike('document_type', `%${filters.document_type}%`);
  }
  if (filters.course_program) {
    query = query.ilike('course_program', `%${filters.course_program}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  return data || [];
}

async function fetchStudentsData(filters: Record<string, string>) {
  let query = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'student');

  // Apply filters
  if (filters.course_program) {
    query = query.ilike('course_program', `%${filters.course_program}%`);
  }
  if (filters.year_level) {
    query = query.eq('year_level', filters.year_level);
  }
  if (filters.verification_status) {
    query = query.eq('verification_status', filters.verification_status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  return data || [];
}

async function fetchAnalyticsData(dateRange: string | null) {
  const daysAgo = new Date();
  if (dateRange && dateRange !== 'all') {
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));
  }

  // Get requests data for analytics
  const { data: requests, error: reqError } = await supabase
    .from('requests')
    .select('*')
    .gte('created_at', dateRange && dateRange !== 'all' ? daysAgo.toISOString() : '1970-01-01')
    .order('created_at', { ascending: false });

  if (reqError) throw reqError;

  // Generate analytics data
  const analytics = [
    {
      metric: 'Total Requests',
      value: requests?.length || 0,
      date_range: dateRange || 'all time'
    },
    {
      metric: 'Pending Requests',
      value: requests?.filter(r => r.status === 'Pending').length || 0,
      date_range: dateRange || 'all time'
    },
    {
      metric: 'Completed Requests',
      value: requests?.filter(r => r.status === 'Completed').length || 0,
      date_range: dateRange || 'all time'
    },
    {
      metric: 'Average Processing Time (days)',
      value: calculateAverageProcessingTime(requests || []),
      date_range: dateRange || 'all time'
    }
  ];

  return analytics;
}

async function fetchAuditData(dateRange: string | null, filters: Record<string, string>) {
  let query = supabase
    .from('audit_logs')
    .select(`
      *,
      profiles!inner(
        full_name,
        email_address,
        student_id
      )
    `);

  // Apply date range filter
  if (dateRange && dateRange !== 'all') {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));
    query = query.gte('created_at', daysAgo.toISOString());
  }

  // Apply filters
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.action) {
    query = query.eq('action', filters.action);
  }
  if (filters.entity_type) {
    query = query.eq('entity_type', filters.entity_type);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  return data || [];
}

async function fetchTemplatesData(filters: Record<string, string>) {
  let query = supabase
    .from('document_templates')
    .select('*');

  // Apply filters
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active === 'true');
  }
  if (filters.template_type) {
    query = query.eq('template_type', filters.template_type);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  return data || [];
}

function calculateAverageProcessingTime(requests: unknown[]): number {
  const completedRequests = requests.filter((r: unknown) => {
    const req = r as { status: string; updated_at: string | null };
    return req.status === 'Completed' && req.updated_at;
  });
  if (completedRequests.length === 0) return 0;

  const processingTimes = completedRequests.map((r: unknown) => {
    const req = r as { created_at: string; updated_at: string };
    const created = new Date(req.created_at);
    const updated = new Date(req.updated_at);
    return (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
  });

  return processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
}

function generateCSV(data: unknown[], type: string): string {
  if (!data || data.length === 0) {
    return 'No data available';
  }

  let headers: string[] = [];
  let rows: string[][] = [];

  switch (type) {
    case 'requests':
      headers = ['ID', 'Student Name', 'Student ID', 'Email', 'Document Type', 'Status', 'Course', 'Year Level', 'Created At', 'Updated At'];
      rows = data.map((req: unknown) => {
        const request = req as {
          id: string;
          full_name: string;
          school_id: string;
          email_address: string;
          document_type: string;
          status: string;
          course_program: string;
          year_level: string;
          created_at: string;
          updated_at: string;
        };
        return [
          request.id?.slice(0, 8) || '',
          request.full_name || '',
          request.school_id || '',
          request.email_address || '',
          request.document_type || '',
          request.status || '',
          request.course_program || '',
          request.year_level || '',
          request.created_at ? new Date(request.created_at).toLocaleString() : '',
          request.updated_at ? new Date(request.updated_at).toLocaleString() : ''
        ];
      });
      break;

    case 'students':
      headers = ['ID', 'Full Name', 'Email', 'Student ID', 'Course Program', 'Year Level', 'Contact Number', 'Verified', 'Verification Status', 'Created At'];
      rows = data.map((student: unknown) => {
        const stu = student as {
          id: string;
          full_name: string;
          email_address: string;
          student_id: string;
          course_program: string;
          year_level: string;
          contact_number: string;
          is_verified: boolean;
          verification_status: string;
          created_at: string;
        };
        return [
          stu.id?.slice(0, 8) || '',
          stu.full_name || '',
          stu.email_address || '',
          stu.student_id || '',
          stu.course_program || '',
          stu.year_level || '',
          stu.contact_number || '',
          stu.is_verified ? 'Yes' : 'No',
          stu.verification_status || '',
          stu.created_at ? new Date(stu.created_at).toLocaleString() : ''
        ];
      });
      break;

    case 'analytics':
      headers = ['Metric', 'Value', 'Date Range'];
      rows = data.map((item: unknown) => {
        const analytics = item as { metric: string; value: number; date_range: string };
        return [
          analytics.metric || '',
          analytics.value?.toString() || '',
          analytics.date_range || ''
        ];
      });
      break;

    case 'audit':
      headers = ['ID', 'User Name', 'Email', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Created At'];
      rows = data.map((log: unknown) => {
        const auditLog = log as {
          id: string;
          profiles: { full_name: string; email_address: string };
          action: string;
          entity_type: string;
          entity_id: string;
          ip_address: string;
          created_at: string;
        };
        return [
          auditLog.id?.slice(0, 8) || '',
          auditLog.profiles?.full_name || '',
          auditLog.profiles?.email_address || '',
          auditLog.action || '',
          auditLog.entity_type || '',
          auditLog.entity_id?.slice(0, 8) || '',
          auditLog.ip_address || '',
          auditLog.created_at ? new Date(auditLog.created_at).toLocaleString() : ''
        ];
      });
      break;

    case 'templates':
      headers = ['ID', 'Name', 'Description', 'File Name', 'File Size', 'Active', 'Created At', 'Updated At'];
      rows = data.map((template: unknown) => {
        const tmpl = template as {
          id: string;
          name: string;
          description: string;
          file_name: string;
          file_size: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        return [
          tmpl.id?.slice(0, 8) || '',
          tmpl.name || '',
          tmpl.description || '',
          tmpl.file_name || '',
          tmpl.file_size ? `${(tmpl.file_size / 1024).toFixed(1)} KB` : '',
          tmpl.is_active ? 'Yes' : 'No',
          tmpl.created_at ? new Date(tmpl.created_at).toLocaleString() : '',
          tmpl.updated_at ? new Date(tmpl.updated_at).toLocaleString() : ''
        ];
      });
      break;

    default:
      headers = Object.keys(data[0] || {});
      rows = data.map((item: unknown) => {
        const obj = item as Record<string, unknown>;
        return Object.values(obj || {}).map(val => String(val || ''));
      });
  }

  // Convert to CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}
