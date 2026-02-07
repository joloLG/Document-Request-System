# Real-Time Functionality Testing Guide

## Overview
The SorSU Document Request System now includes real-time updates for student-registrar transactions. This guide explains how to test and verify the real-time functionality.

## Features Implemented

### 1. Real-Time Status Updates
- **Students**: See instant status updates when registrars change request status
- **Registrars**: See instant updates when students submit new requests
- **No page refresh required**: Updates happen automatically via WebSocket connections

### 2. Real-Time Notifications
- Visual notifications appear for status changes
- Auto-dismiss after 8 seconds
- Manual dismiss option available
- Different notification types (success, warning, error, info)

### 3. Live Request Management
- Students see their request status change in real-time
- Registrars see new requests appear instantly
- Both parties see status changes without refreshing

## Testing Scenarios

### Scenario 1: Student Submits New Request
**Steps:**
1. Open student dashboard in one browser/tab
2. Open registrar dashboard in another browser/tab (logged in as registrar)
3. Student submits a new document request
4. **Expected Result**: Registrar dashboard shows new request instantly without refresh

### Scenario 2: Registrar Updates Request Status
**Steps:**
1. Have an existing request in "Pending" status
2. Student dashboard open showing the request
3. Registrar changes status to "On Process"
4. **Expected Result**: Student dashboard shows status change instantly with notification

### Scenario 3: Multiple Status Updates
**Steps:**
1. Student has a request in "On Process" status
2. Registrar updates to "Ready for Pick-up"
3. Student sees instant update
4. Registrar updates to "Completed"
5. **Expected Result**: Each status change appears instantly on student dashboard

### Scenario 4: Real-Time Notification Display
**Steps:**
1. Trigger a status change while student is viewing dashboard
2. **Expected Result**: 
   - Notification appears in top-right corner
   - Shows message about status change
   - Auto-dismisses after 8 seconds
   - Can be manually dismissed

## Technical Implementation

### Real-Time Subscriptions
- Uses Supabase Realtime with PostgreSQL publications
- WebSocket connections for instant updates
- Role-based filtering (students see only their requests, registrars see all)

### Database Setup
Run the `enable-realtime.sql` script to:
- Enable real-time publications
- Set up Row Level Security policies
- Grant appropriate permissions

### Client-Side Implementation
- Custom React hooks (`useRealtimeDocumentRequests`)
- Automatic connection management
- Error handling and reconnection logic
- TypeScript support for type safety

## Troubleshooting

### Common Issues

1. **Real-time updates not working**
   - Check if `enable-realtime.sql` was executed
   - Verify Supabase project has real-time enabled
   - Check browser console for WebSocket errors

2. **Permission errors**
   - Ensure RLS policies are correctly set
   - Check user roles in profiles table
   - Verify authentication status

3. **Performance issues**
   - Real-time subscriptions are automatically cleaned up on unmount
   - Connection status is monitored and logged
   - Efficient state updates prevent unnecessary re-renders

### Debugging Tools
- Browser console shows real-time connection status
- Network tab shows WebSocket connections
- React DevTools can inspect hook states

## Browser Compatibility
Real-time functionality requires:
- Modern browsers with WebSocket support
- JavaScript enabled
- Stable internet connection

## Performance Considerations
- Real-time subscriptions use minimal bandwidth
- Only relevant data is transmitted based on user role
- Automatic cleanup prevents memory leaks
- Efficient state management prevents unnecessary re-renders
