# Real-time Setup Guide - Corrected

## Issue Resolution
The errors occurred because PostgreSQL real-time publications only support **base tables**, not **views**. The system was trying to add views like `registrar_requests_view` to the publication, which is not supported.

## Solution
Real-time subscriptions work on the underlying base tables (`requests`, `profiles`, `notifications`), and your application code handles the filtering and logic.

## Setup Instructions

### 1. Run the Corrected SQL Script
```sql
-- Execute enable-realtime-corrected.sql in your Supabase project
```

This script:
- ✅ Creates publication on base tables only (requests, profiles, notifications)
- ✅ Sets up proper RLS policies for real-time access
- ✅ Handles existing objects gracefully

### 2. How Real-time Works in This System

**For Students:**
- Subscribes to `requests` table with filter: `user_id=eq.{student_id}`
- Only sees their own request updates
- Gets instant notifications when status changes

**For Registrars:**
- Subscribes to `requests` table with no filter (sees all requests)
- Gets instant notifications when new requests are submitted
- Sees all status changes across all requests

### 3. Testing the Setup

#### Test 1: Student Submits Request
1. Open student dashboard
2. Open registrar dashboard in another tab
3. Student submits new request
4. **Expected:** Registrar sees new request instantly

#### Test 2: Registrar Updates Status
1. Have an existing "Pending" request
2. Student dashboard shows the request
3. Registrar changes status to "On Process"
4. **Expected:** Student sees status change instantly

#### Test 3: Verify Real-time Connection
Check browser console for:
```
Real-time subscription status: SUBSCRIBED
Real-time update received: {eventType: "UPDATE", new: {...}}
```

### 4. Troubleshooting

#### If real-time doesn't work:
1. **Check SQL execution:** Ensure `enable-realtime-corrected.sql` ran successfully
2. **Check permissions:** Verify RLS policies are created
3. **Check browser console:** Look for WebSocket connection errors
4. **Check Supabase dashboard:** Ensure real-time is enabled for your project

#### Common issues:
- **"relation does not exist"** → Run the corrected SQL script
- **Permission denied** → Check RLS policies and user roles
- **No updates received** → Check browser console for WebSocket errors

### 5. Technical Details

**What's happening under the hood:**
1. WebSocket connection established to Supabase
2. Subscription created on `requests` table
3. RLS policies filter data based on user role
4. Changes (INSERT/UPDATE) trigger real-time events
5. Application receives payload and updates UI

**Key points:**
- Views are not supported in real-time publications
- Base tables (`requests`, `profiles`, `notifications`) are used instead
- Application logic handles the data transformation
- RLS ensures data security and proper filtering

### 6. Database Schema Reference

**Requests Table (real-time enabled):**
```sql
requests (
  id uuid,
  user_id uuid,  -- Used for filtering student access
  document_type text,
  status text,   -- Field that triggers updates
  created_at timestamptz,
  updated_at timestamptz,
  -- ... other fields
)
```

**Profiles Table (real-time enabled):**
```sql
profiles (
  id uuid,      -- Same as auth.users.id
  role text,    -- 'student' or 'registrar'
  -- ... other fields
)
```

This setup ensures secure, efficient real-time updates while maintaining data privacy and proper access control.
