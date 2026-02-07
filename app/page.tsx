import Link from "next/link";
import Image from "next/image";
import { FileText, ShieldCheck, Clock, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/images/sorsu-logo.png"
              alt="SorSU Logo"
              width={48}
              height={48}
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
            />
            <div>
              <h1 className="text-lg font-bold text-gray-900 sm:text-xl">SorSU Document System</h1>
              <p className="text-[10px] text-gray-500 font-medium tracking-wide uppercase sm:text-xs">
                Sorsogon State University
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-gray-600 hover:text-sorsuMaroon transition-colors hidden sm:block"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-sorsuMaroon px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-maroon-900 hover:shadow-lg hover:ring-2 hover:ring-maroon-500/50 active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-8 flex justify-center">
                <div className="relative rounded-full px-3 py-1 text-sm leading-6 text-gray-600 ring-1 ring-gray-200 hover:ring-gray-200/20 bg-gray-50 transition-colors">
                  Now accepting online requests.{" "}
                  <Link href="/login" className="font-semibold text-sorsuMaroon hover:text-maroon-800 hover:underline transition-colors">
                    <span className="absolute inset-0" aria-hidden="true" />
                    Request now <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl mb-6">
                Request Academic Documents <span className="text-sorsuMaroon">Securely Online</span>
              </h1>
              <p className="text-lg leading-8 text-gray-600 mb-10">
                Skip the long lines. Request your Transcript of Records, Diploma, and other certifications from anywhere, anytime. Secure, fast, and convenient.
              </p>
              <div className="flex items-center justify-center gap-x-6">
                <Link
                  href="/register"
                  className="rounded-lg bg-sorsuMaroon px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-maroon-900 hover:shadow-lg hover:ring-2 hover:ring-maroon-500/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-500 transition-all flex items-center gap-2"
                >
                  Create Account <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="text-sm font-semibold leading-6 text-gray-600 hover:text-sorsuMaroon transition-colors">
                  Log in <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-gray-50 py-24 sm:py-32 transition-colors">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-base font-semibold leading-7 text-sorsuMaroon uppercase tracking-wide">Faster & Safer</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Modernizing Student Services
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                Designed to make document processing efficient for students and the registrar.
              </p>
            </div>
            <div className="mx-auto max-w-2xl lg:max-w-none">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Feature 1 */}
                <div className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 transition-all hover:shadow-md">
                  <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-maroon-50">
                    <FileText className="h-6 w-6 text-sorsuMaroon" />
                  </div>
                  <h3 className="text-lg font-semibold leading-8 text-gray-900">Online Requests</h3>
                  <p className="mt-2 flex-auto text-base leading-7 text-gray-600">
                    Submit requests for TOR, Diploma, and Good Moral without visiting the campus. Track status in real-time.
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 transition-all hover:shadow-md">
                  <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-maroon-50">
                    <ShieldCheck className="h-6 w-6 text-sorsuMaroon" />
                  </div>
                  <h3 className="text-lg font-semibold leading-8 text-gray-900">Secure Encryption</h3>
                  <p className="mt-2 flex-auto text-base leading-7 text-gray-600">
                    Documents are encrypted with AES-GCM before storage. Only you possess the key to decrypt and view them.
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 transition-all hover:shadow-md">
                  <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-maroon-50">
                    <Clock className="h-6 w-6 text-sorsuMaroon" />
                  </div>
                  <h3 className="text-lg font-semibold leading-8 text-gray-900">Real-time Updates</h3>
                  <p className="mt-2 flex-auto text-base leading-7 text-gray-600">
                    Receive instant notifications via email and the portal when your documents are ready for download or pick-up.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 transition-colors">
        <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
          <div className="flex justify-center space-x-6 md:order-2">
            <span className="text-sm text-gray-500">
              Registrar&apos;s Office • Sorsogon State University
            </span>
          </div>
          <div className="mt-8 md:order-1 md:mt-0">
            <p className="text-center text-xs leading-5 text-gray-500">
              &copy; {new Date().getFullYear()} SorSU Document Request System. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
