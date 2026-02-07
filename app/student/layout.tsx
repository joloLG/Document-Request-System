"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, Bell, FileText, Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/student/home", label: "Home", icon: Home },
    { href: "/student/requirements", label: "Requirements", icon: FileText },
    { href: "/student/notifications", label: "Updates", icon: Bell },
    { href: "/student/profile", label: "Profile", icon: User },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen bg-gray-50 transition-colors duration-300">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto transition-colors duration-300">
          {/* Logo */}
          <div className="flex items-center shrink-0 px-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-sorsuMaroon rounded-lg flex items-center justify-center shadow-lg shadow-maroon-900/20">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 transition-colors">SorSU</h2>
                <p className="text-xs text-gray-500 transition-colors">Student Portal</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-sorsuMaroon text-white shadow-md shadow-maroon-900/20"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 ${isActive ? "text-white" : "text-gray-400 group-hover:text-gray-500"}`} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Sign Out Button */}
          <div className="px-4 mt-auto">
            <button
              onClick={handleSignOut}
              className="group flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-maroon-50 hover:text-sorsuMaroon transition-all w-full"
            >
              <LogOut className="mr-3 h-5 w-5 text-gray-400 group-hover:text-maroon-500 transition-colors" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 transition-colors duration-300">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-sorsuMaroon rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-gray-900">SorSU</h1>
                  <p className="text-[10px] text-gray-500">Student Portal</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Slide-out Menu */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform duration-300 ease-in-out lg:hidden border-r border-gray-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex flex-col h-full">
            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-sorsuMaroon rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">SorSU</h2>
                  <p className="text-xs text-gray-500">Student Portal</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive
                        ? "bg-sorsuMaroon text-white shadow-md shadow-maroon-900/20"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <Icon className={`mr-3 h-5 w-5 ${isActive ? "text-white" : "text-gray-400 group-hover:text-gray-500"}`} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Sign Out */}
            <div className="px-4 py-4 border-t border-gray-200 transition-colors">
              <button
                onClick={handleSignOut}
                className="group flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-maroon-50 hover:text-sorsuMaroon transition-all w-full"
              >
                <LogOut className="mr-3 h-5 w-5 text-gray-400 group-hover:text-maroon-500 transition-colors" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 transition-colors duration-300 pb-safe">
          <div className="grid grid-cols-4 py-2">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-sorsuMaroon"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <Icon className={`h-5 w-5 mb-1 ${isActive ? "fill-current" : ""}`} />
                  <span className="truncate max-w-full">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
