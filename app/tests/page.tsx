"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Sample data (replace with your saved tests state)
const sampleTests = [
  {
    url: "https://example.com/login",
    tests: [
      { title: "Page loads with HTTP 200", info: "Basic page load check" },
      { title: "Login form visible", info: "Checks if login form renders" },
      { title: "Submit button clickable", info: "Button can be clicked" },
    ],
  },
  {
    url: "https://example.com/dashboard",
    tests: [
      { title: "Page loads with HTTP 200", info: "Dashboard load" },
      { title: "Graphs render correctly", info: "Check all charts display" },
    ],
  },
];

export default function TestsPage() {
  const [testsData, setTestsData] = useState(sampleTests);

  return (
    <div className="flex flex-col h-screen">
      {/* Top Navbar (reuse your TestFlow AI navbar) */}
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

      <div className="pt-24 px-8 overflow-y-auto flex-1">
        <h1 className="text-3xl font-bold mb-6">Saved Tests</h1>

        <div className="space-y-4">
          {testsData.map((page, i) => (
            <Card key={i} className="border rounded-lg">
              <CardHeader>
                <CardTitle>
                  <Collapsible>
                    <CollapsibleTrigger className="w-full text-left px-4 py-3 hover:bg-gray-100 rounded-md cursor-pointer">
                      {page.url}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 py-2">
                      <div className="space-y-2">
                        {page.tests.map((t, idx) => (
                          <Card key={idx} className="border rounded-md p-3 bg-gray-50">
                            <CardHeader>
                              <CardTitle className="text-sm font-semibold">{t.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs text-gray-600">{t.info}</CardContent>
                          </Card>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
