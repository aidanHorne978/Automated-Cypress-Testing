"use client";

import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col">
      {/* Top Navbar */}
      <nav className="w-full flex items-center justify-between px-8 py-4 shadow-sm bg-white/70 backdrop-blur-md fixed top-0 left-0 z-50">
        <div className="text-2xl font-bold">TestFlow AI</div>
        <div className="flex items-center gap-6 text-lg font-medium">
          <a href="/ai-test-creation" className="hover:text-gray-600">AI Test Creation</a>
          <a href="/dashboard" className="hover:text-gray-600">Dashboard</a>
          <a href="/tests" className="hover:text-gray-600">Tests</a>
          <a href="/settings" className="hover:text-gray-600">Settings</a>
          <Button className="rounded-2xl px-6 py-2 text-base">Get Started</Button>
        </div>
      </nav>

      {/* Dashboard Hero / Welcome Section */}
      <section className="flex flex-col items-center justify-center text-center px-8 pt-40 pb-20">
        <h1 className="text-4xl font-bold max-w-3xl mb-4">Welcome to Your Dashboard</h1>
        <p className="text-lg text-gray-600 max-w-2xl mb-10">
          Manage and monitor your AI-generated Cypress tests, track project progress, and access your settings all in one place.
        </p>

        {/* Placeholder area for dashboard cards or stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl">
          <div className="p-6 bg-white rounded-2xl shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2">Total Tests</h2>
            <p className="text-gray-600 text-2xl">42</p>
          </div>

          <div className="p-6 bg-white rounded-2xl shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2">Projects</h2>
            <p className="text-gray-600 text-2xl">5</p>
          </div>

          <div className="p-6 bg-white rounded-2xl shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2">Flaky Tests</h2>
            <p className="text-gray-600 text-2xl">3</p>
          </div>

          <div className="p-6 bg-white rounded-2xl shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2">Completed Runs</h2>
            <p className="text-gray-600 text-2xl">128</p>
          </div>
        </div>
      </section>
    </div>
  );
}