"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Hash, BookOpen, Phone, LogOut, Loader2, User, Building } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

type Profile = {
  id: string;
  student_id: string;
  full_name: string;
  email_address: string;
  course_program: string;
  contact_number: string;
};

export default function StudentProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        setError(error.message);
      } else {
        setProfile(data);
      }
      setLoading(false);
    };

    void fetchProfile();
  }, [router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed");
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-sorsuMaroon" />
          <p className="mt-4 text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-maroon-200 bg-maroon-50 p-4 text-sm text-maroon-700 transition-colors">
        <span>{error}</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center transition-colors">
        <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Profile not found</h3>
        <p className="text-sm text-gray-500">Unable to load your profile information</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sorsuMaroon text-white shadow-lg shadow-maroon-900/20">
              <User className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
              <p className="text-sm text-gray-500 mt-1">Your personal information</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 rounded-lg bg-maroon-50 px-4 py-2.5 text-sm font-medium text-maroon-600 hover:bg-maroon-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-colors">
        {/* Profile Header */}
        <div className="bg-linear-to-r from-sorsuMaroon to-maroon-900 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10">
                <User className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </div>
              <div className="text-white">
                <h2 className="text-xl sm:text-2xl font-bold">{profile.full_name}</h2>
                <p className="text-sm sm:text-base opacity-90">Student ID: {profile.student_id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="p-6 sm:p-8">
          <div className="space-y-6">
            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-400" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email Address</p>
                      <p className="text-sm text-gray-900 mt-1">{profile.email_address}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact Number</p>
                      <p className="text-sm text-gray-900 mt-1">{profile.contact_number}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Academic Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-gray-400" />
                Academic Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Hash className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Student ID</p>
                      <p className="text-sm text-gray-900 mt-1">{profile.student_id}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Course Program</p>
                      <p className="text-sm text-gray-900 mt-1">{profile.course_program}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Update Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 transition-colors">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">Profile Updates</h4>
                  <p className="text-sm text-blue-700">
                    To update your profile information, please visit the Registrar&apos;s Office with valid identification documents.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
