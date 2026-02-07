"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut, FileText, BarChart3, Users, Bell, ShieldCheck, FileDown, Database, Home } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

const navigationItems = [
  { name: "Dashboard", href: "/registrar/dashboard", icon: Home },
  { name: "Analytics", href: "/registrar/analytics", icon: BarChart3 },
  { name: "Document Templates", href: "/registrar/templates", icon: FileText },
  { name: "Student Verification", href: "/registrar/verification", icon: ShieldCheck },
  { name: "Notifications", href: "/registrar/notifications", icon: Bell },
  { name: "Audit Log", href: "/registrar/audit", icon: Database },
  { name: "Reports & Exports", href: "/registrar/reports", icon: FileDown },
];

export default function RegistrarNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4">
      <div className="flex items-center justify-between gap-3 max-w-[1600px] mx-auto w-full">
        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-sorsuMaroon flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Registrar Portal</h1>
              <p className="text-xs text-gray-500">SorSU Document Request System</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="hidden lg:flex items-center gap-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sorsuMaroon text-white"
                    : "text-gray-600 hover:text-sorsuMaroon hover:bg-gray-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Mobile Navigation Toggle */}
        <div className="flex items-center gap-2">
          {/* Sign Out Button */}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 md:px-4 md:py-2 text-xs md:sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-sorsuMaroon transition-colors"
          >
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <div className="lg:hidden mt-3 pt-3 border-t border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-sorsuMaroon text-white"
                    : "text-gray-600 hover:text-sorsuMaroon hover:bg-gray-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-center">{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
