import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface DocumentRequest {
  id: string;
  user_id: string;
  document_type: string;
  year_level: string | null;
  verification_url: string | null;
  status: 'Pending' | 'On Process' | 'Cancelled' | 'Ready for Pick-up' | 'Completed';
  cancellation_reason: string | null;
  encrypted_file_bucket: string | null;
  encrypted_file_path: string | null;
  encryption_alg: string | null;
  encryption_iv: string | null;
  encryption_salt: string | null;
  encryption_iterations: number | null;
  original_file_name: string | null;
  original_mime_type: string | null;
  original_size_bytes: number | null;
  decryption_key: string | null;
  uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RealtimeSubscriptionPayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: DocumentRequest;
  old?: DocumentRequest;
}

export interface NotificationPayload {
  id: string;
  user_id: string;
  message: string;
  type: string;
  created_at: string;
  read: boolean;
}

export function useRealtimeDocumentRequests(
  userId: string,
  userRole: 'student' | 'registrar',
  onNewRequest?: (request: DocumentRequest) => void,
  onStatusUpdate?: (request: DocumentRequest) => void
) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const handleRealtimeUpdate = useCallback((payload: RealtimePostgresChangesPayload<DocumentRequest>) => {
    console.log('Real-time update received:', payload);

    if (payload.eventType === 'INSERT' && payload.new) {
      // New request submitted
      if (userRole === 'registrar' && onNewRequest) {
        onNewRequest(payload.new as DocumentRequest);
      }
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      // Status updated
      if (userRole === 'student' && onStatusUpdate) {
        onStatusUpdate(payload.new as DocumentRequest);
      } else if (userRole === 'registrar' && onStatusUpdate) {
        onStatusUpdate(payload.new as DocumentRequest);
      }
    }
  }, [userRole, onNewRequest, onStatusUpdate]);

  useEffect(() => {
    if (!userId || !userRole) return;

    const channelName = userRole === 'student' 
      ? `student_requests_${userId}` 
      : `registrar_requests`;

    const newChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: userRole === 'student' 
            ? `user_id=eq.${userId}`
            : undefined
        },
        handleRealtimeUpdate
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Use requestAnimationFrame to schedule setState after the current render
    requestAnimationFrame(() => {
      channelRef.current = newChannel;
      setChannel(newChannel);
    });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, userRole, handleRealtimeUpdate]);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setChannel(null);
      setIsConnected(false);
    }
  }, []);

  return { channel, isConnected, disconnect };
}

export function useRealtimeNotifications(
  userId: string,
  onNewNotification?: (notification: NotificationPayload) => void
) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const newChannel = supabase
      .channel(`notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload: RealtimePostgresChangesPayload<NotificationPayload>) => {
          console.log('New notification received:', payload);
          if (payload.new && onNewNotification) {
            onNewNotification(payload.new as NotificationPayload);
          }
        }
      )
      .subscribe((status) => {
        console.log('Notifications subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Use setTimeout to avoid setState in effect
    setTimeout(() => setChannel(newChannel), 0);

    return () => {
      if (newChannel) {
        supabase.removeChannel(newChannel);
      }
    };
  }, [userId, onNewNotification]);

  const disconnect = () => {
    if (channel) {
      supabase.removeChannel(channel);
      setChannel(null);
      setIsConnected(false);
    }
  };

  return { isConnected, disconnect };
}
