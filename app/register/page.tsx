"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, User, Mail, BookOpen, Phone, Lock, Loader2 } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";

export default function Register() {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    studentId: "",
    course: "",
    contact: "",
  });

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (formData.password.length < 8) {
        throw new Error("Password must be at least 8 characters long.");
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            student_id: formData.studentId,
            course_program: formData.course,
            contact_number: formData.contact,
            role: "student",
          },
        },
      });

      if (signUpError) throw signUpError;

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border-t-8 border-sorsuMaroon p-8 text-center transition-colors">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-6 transition-colors">
            <Mail className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2 transition-colors">Registration Successful!</h2>
          <p className="text-gray-600 mb-8 transition-colors">
            Please check your email <strong>{formData.email}</strong> to verify your account before logging in.
          </p>
          <Link
            href="/login"
            className="block w-full bg-sorsuMaroon text-white font-bold py-3 rounded-lg shadow-lg transition-all transform hover:scale-[1.01] hover:ring-2 hover: active:scale-[0.98]"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300">
      <div className="mb-8 text-center">
        <Image
          src="/images/sorsu-logo.png"
          alt="SorSU Logo"
          width={128}
          height={128}
          className="w-24 h-24 mx-auto drop-shadow-md object-contain"
        />
        <h1 className="mt-4 text-2xl font-bold text-sorsuMaroon">Create Student Account</h1>
        <p className="text-gray-600 text-sm">Sorsogon State University</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border-t-8 border-sorsuMaroon transition-colors duration-300">
        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm rounded transition-colors">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Juan dela Cruz"
                  required
                  className="block w-full pl-9 pr-3 py-2 border border-gray-300 bg-white rounded-lg focus:ring-sorsuMaroon focus:border-sorsuMaroon text-sm transition-colors"
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                Student ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <BookOpen className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="202X-0000-X"
                  required
                  className="block w-full pl-9 pr-3 py-2 border border-gray-300 bg-white rounded-lg focus:ring-sorsuMaroon focus:border-sorsuMaroon text-sm transition-colors"
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  placeholder="student@sorsu.edu.ph"
                  required
                  className="block w-full pl-9 pr-3 py-2 border border-gray-300 bg-white rounded-lg focus:ring-sorsuMaroon focus:border-sorsuMaroon text-sm transition-colors"
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                  Course
                </label>
                <select
                  required
                  className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-lg focus:ring-sorsuMaroon focus:border-sorsuMaroon text-sm transition-colors"
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                >
                  <option value="">Select a course</option>
                  <option value="BSIT">BSIT - Bachelor of Science in Information Technology</option>
                  <option value="BSIS">BSIS - Bachelor of Science in Information Systems</option>
                  <option value="BSAIS">BSAIS - Bachelor of Science in Agricultural Information Systems</option>
                  <option value="BTVTED">BTVTED - Bachelor of Technical-Vocational Teacher Education</option>
                  <option value="BSCS">BSCS - Bachelor of Science in Computer Science</option>
                  <option value="BPA">BPA - Bachelor of Public Administration</option>
                  <option value="ENTREP">ENTREP - Entrepreneurship</option>
                  <option value="Accountancy">Accountancy</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                  Mobile No.
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="0912..."
                    required
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 bg-white rounded-lg focus:ring-sorsuMaroon focus:border-sorsuMaroon text-sm transition-colors"
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  className="block w-full pl-9 pr-10 py-2 border border-gray-300 bg-white rounded-lg focus:ring-sorsuMaroon focus:border-sorsuMaroon text-sm transition-colors"
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-sorsuMaroon transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sorsuMaroon text-white font-bold py-3 rounded-lg shadow-lg transition-all transform hover:scale-[1.01] hover:ring-2 hover: active:scale-[0.98] flex items-center justify-center space-x-2 mt-6"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <span>Register Account</span>
              )}
            </button>

            <div className="mt-4 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-sorsuMaroon font-bold hover:text-maroon-900 hover:underline transition-colors">
                Login here
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}