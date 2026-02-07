"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle, Clock, Loader2, CheckSquare } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

type NotificationRow = {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      // Fetch initial notifications
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setNotifications(data || []);
      }
      setLoading(false);

      // Setup Realtime subscription
      channel = supabase
        .channel("notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as NotificationRow, ...prev]);
          }
        )
        .subscribe();
    };

    void init();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      setError(error.message);
    } else {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    }
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);

    if (error) {
      setError(error.message);
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
    setMarkingAll(false);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sorsuMaroon text-white shadow-lg shadow-maroon-900/20">
              <Bell className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 transition-colors">Notifications</h1>
              <p className="text-sm text-gray-500 mt-1 transition-colors">
                {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={markingAll}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {markingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckSquare className="h-4 w-4" />
              )}
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 transition-colors">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-sorsuMaroon" />
            <p className="mt-4 text-sm text-gray-600">Loading notifications...</p>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-maroon-200 bg-maroon-50 p-4 text-sm text-maroon-700 transition-colors">
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {notifications.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center transition-colors">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications yet</h3>
                <p className="text-sm text-gray-500">
                  You&apos;ll see updates about your document requests here
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-xl shadow-sm border transition-all duration-200 hover:shadow-md ${
                    notification.is_read
                      ? "border-gray-200 opacity-75"
                      : "border-sorsuMaroon bg-maroon-50/10"
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        notification.is_read
                          ? "bg-gray-100"
                          : "bg-sorsuMaroon shadow-lg shadow-maroon-900/20"
                      }`}>
                        {notification.is_read ? (
                          <CheckCircle className="h-5 w-5 text-gray-500" />
                        ) : (
                          <Bell className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <p className={`text-sm leading-relaxed transition-colors ${
                            notification.is_read ? "text-gray-600" : "text-gray-900 font-medium"
                          }`}>
                            {notification.message}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-gray-500 transition-colors">
                            <Clock className="h-3 w-3" />
                            {new Date(notification.created_at).toLocaleString()}
                          </div>
                          {!notification.is_read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="text-xs font-medium text-sorsuMaroon hover:text-maroon-900 transition-colors"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
