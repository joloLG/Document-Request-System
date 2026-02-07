"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Lock, User, Loader2 } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState(""); // Can be Email or Student ID
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('🚀 Login function started');
    setLoading(true);
    setError(null);

    const loginEmail = identifier;
    console.log('📧 Using email:', loginEmail);

    try {
      // SIMPLIFIED: Skip Student ID lookup for now, just use email directly
      console.log('🔐 Attempting authentication...');

      // 2. Authenticate with Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (authError) {
        console.log('❌ Authentication failed:', authError);
        throw authError;
      }

      console.log('✅ Authentication successful!');
      console.log('👤 User email:', data.user?.email);
      console.log('👤 User ID:', data.user?.id);

      // TEMPORARILY: Just redirect to student home for testing
      console.log('🚀 REDIRECTING TO STUDENT HOME (TEMPORARY)');
      window.location.href = "/student/home";
      
    } catch (err: unknown) {
      console.log('❌ Login error:', err);
      setError(err instanceof Error ? err.message : "Login failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 transition-colors duration-300">
      {/* SorSU Logo */}
      <div className="mb-8 text-center">
        <Image
          src="/images/sorsu-logo.png"
          alt="SorSU Logo"
          width={128}
          height={128}
          className="w-32 h-32 mx-auto drop-shadow-md object-contain"
        />
        <h1 className="mt-4 text-2xl font-bold text-sorsuMaroon">
          SorSU Document Request System
        </h1>
        <p className="text-gray-600 text-sm">Sorsogon State University</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border-t-8 border-sorsuMaroon transition-colors duration-300">
        <div className="p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Login to your account</h2>

          {error && (
            <div className="mb-4 p-3 bg-maroon-100 border-l-4 border-maroon-500 text-maroon-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Identifier Input (Email or ID) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student ID or Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-sorsuMaroon focus:border-sorsuMaroon text-sm transition"
                  placeholder="2021-0000-X or email@sorsu.edu.ph"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-sorsuMaroon focus:border-sorsuMaroon text-sm transition"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-sorsuMaroon transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sorsuMaroon hover:bg-maroon-900 text-white font-bold py-3 rounded-lg shadow-lg transition-all transform hover:scale-[1.01] hover:ring-2 hover:ring-maroon-500/50 active:scale-[0.98] flex items-center justify-center space-x-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-sorsuMaroon font-bold hover:text-maroon-900 hover:underline transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-400 uppercase tracking-widest">
        Official Document Request Portal
      </p>
    </div>
  );
}