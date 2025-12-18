"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { LoadingState } from "@/components/ui/skeleton";
import { DatabaseService } from "@/lib/database";

interface StoredTestData {
  url: string;
  tests: any[];
  summary: string;
  timestamp: number;
  userDescription?: string;
}

export default function AiTestGen() {
  const [url, setUrl] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState("");

  const [aiTests, setAiTests] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previousTestsCount, setPreviousTestsCount] = useState(0);
  const [newTestsAdded, setNewTestsAdded] = useState(false);
  const [testSources, setTestSources] = useState<{general: number, elements: number} | null>(null);

  const [progress, setProgress] = useState<{
    stage: 'idle' | 'scanning' | 'analyzing' | 'generating' | 'complete';
    message: string;
    percent: number;
  } | null>(null);

  // Database/localStorage operations with fallback
  const loadStoredTests = async (url: string): Promise<StoredTestData | null> => {
    try {
      // Try database first
      const dbResult = await DatabaseService.getLatestTestsForUrl(url);
      if (dbResult) {
        return {
          url: dbResult.url,
          tests: dbResult.tests,
          summary: dbResult.summary,
          timestamp: dbResult.timestamp,
        };
      }
    } catch (error) {
      console.warn("Database not available, falling back to localStorage:", error);
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(`testflow_tests_${url}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      return null;
    }
  };

  const saveStoredTests = async (url: string, tests: any[], summary: string, userDescription?: string) => {
    try {
      // Try database first
      await DatabaseService.saveTestSession(url, tests, summary, navigator.userAgent);
    } catch (error) {
      console.warn("Database not available, falling back to localStorage:", error);

      // Fallback to localStorage
      try {
        const data: StoredTestData = {
          url,
          tests,
          summary,
          timestamp: Date.now(),
          userDescription,
        };
        localStorage.setItem(`testflow_tests_${url}`, JSON.stringify(data));
      } catch (storageError) {
        console.error("Error saving to localStorage:", storageError);
      }
    }
  };

  // Load stored tests when URL changes
  useEffect(() => {
    const loadTests = async () => {
      if (url) {
        try {
          const stored = await loadStoredTests(url);
          if (stored && stored.tests.length > 0) {
            setAiTests(stored.tests);
            setAiSummary(stored.summary || "");
            setPreviousTestsCount(stored.tests.length);
            console.log(`Loaded ${stored.tests.length} previous tests for ${url}`);
          } else {
            setAiTests([]);
            setAiSummary("");
            setPreviousTestsCount(0);
          }
        } catch (error) {
          console.error("Error loading tests:", error);
          setAiTests([]);
          setAiSummary("");
          setPreviousTestsCount(0);
        }
      } else {
        // Clear when URL is empty
        setAiTests([]);
        setAiSummary("");
        setPreviousTestsCount(0);
      }
    };

    loadTests();
  }, [url]);

  const scanPage = async () => {
    setLoading(true);
    setHasError(false);
    setNewTestsAdded(false);
    setTestSources(null);
    setProgress({
      stage: 'scanning',
      message: 'Taking screenshot and analyzing page structure...',
      percent: 10
    });

    try {
      const res = await fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      const data = await res.json();
      setScreenshot(data.screenshot);
      setProgress({
        stage: 'analyzing',
        message: 'Analyzing page elements and structure...',
        percent: 40
      });

      // Make parallel API calls: one for general tests, one for element-specific tests
      const [generalTestsRes, elementTestsRes] = await Promise.allSettled([
        // General tests based on DOM structure
        fetch("/api/ai-testgen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            screenshot: data.screenshot,
            domData: data.domData,
            url,
            userDescription: analysis
          })
        }).then(res => {
          setProgress(prev => prev ? {
            ...prev,
            message: 'Generating general test scenarios...',
            percent: 60
          } : null);
          return res;
        }),
        // Element-specific tests based on HTML
        data.htmlElements && data.htmlElements.length > 0
          ? fetch("/api/ai-testgen-elements", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                htmlElements: data.htmlElements,
                url,
                userDescription: analysis
              })
            }).then(res => {
              setProgress(prev => prev ? {
                ...prev,
                message: 'Generating element-specific tests...',
                percent: 80
              } : null);
              return res;
            })
          : Promise.resolve(null)
      ]);

      // Process general tests
      let generalTestsData: any = { tests: [], summary: "" };
      if (generalTestsRes.status === "fulfilled" && generalTestsRes.value) {
        try {
          generalTestsData = await generalTestsRes.value.json();
        } catch (err) {
          console.error("Error parsing general tests:", err);
        }
      }

      // Process element tests
      let elementTestsData: any = { tests: [], summary: "" };
      if (elementTestsRes.status === "fulfilled" && elementTestsRes.value) {
        try {
          elementTestsData = await elementTestsRes.value.json();
        } catch (err) {
          console.error("Error parsing element tests:", err);
        }
      }

      // Combine both test sets
      const combinedTests = [
        ...(generalTestsData.tests || []),
        ...(elementTestsData.tests || [])
      ];
      
      const combinedSummary = [
        generalTestsData.summary && "General Tests:\n" + generalTestsData.summary,
        elementTestsData.summary && "Element Tests:\n" + elementTestsData.summary
      ].filter(Boolean).join("\n\n");

      const aiData = {
        ...generalTestsData,
        tests: combinedTests,
        summary: combinedSummary || generalTestsData.summary,
        _error: generalTestsData._error || elementTestsData._error || false
      };

      setHasError(aiData._error || false);
      setProgress({
        stage: 'complete',
        message: `Generated ${combinedTests.length} tests successfully!`,
        percent: 100
      });

      // Clear progress after a short delay
      setTimeout(() => setProgress(null), 2000);
      
      // Track test sources for display
      setTestSources({
        general: generalTestsData.tests?.length || 0,
        elements: elementTestsData.tests?.length || 0
      });
      
      console.log(`Generated ${aiData.tests?.length || 0} total tests (${generalTestsData.tests?.length || 0} general + ${elementTestsData.tests?.length || 0} element-specific)`);
      
      // Check if we have previous tests for this URL
      const previousData = await loadStoredTests(url);
      const newTests = aiData.tests || [];

      if (previousData && previousData.tests.length > 0 && !aiData._error) {
        // Append new tests to existing ones (avoid duplicates by title)
        const existingTitles = new Set(previousData.tests.map((t: any) => t.title));
        const uniqueNewTests = newTests.filter((t: any) => !existingTitles.has(t.title));
        const combinedTests = [...previousData.tests, ...uniqueNewTests];

        setAiTests(combinedTests);
        setAiSummary(aiData.summary || previousData.summary);
        setPreviousTestsCount(previousData.tests.length);
        setNewTestsAdded(uniqueNewTests.length > 0);

        // Save combined results
        await saveStoredTests(url, combinedTests, aiData.summary || previousData.summary, analysis);
      } else {
        // First time or error - use new data
        setAiTests(newTests);
        setAiSummary(aiData.summary);
        setPreviousTestsCount(newTests.length);
        setNewTestsAdded(false);

        // Save new results
        if (!aiData._error) {
          await saveStoredTests(url, newTests, aiData.summary, analysis);
        }
      }
    } catch (error) {
      console.error("Error scanning page:", error);
      setHasError(true);
      setAiSummary(`Error: Failed to scan page or generate tests. ${error instanceof Error ? error.message : "Unknown error"}`);
      setAiTests([]);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
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

    <div className="flex flex-1 overflow-hidden pt-24">
        {/* LEFT SIDE */}
        <div className="w-1/3 border-r p-6 space-y-4 overflow-y-auto">
            <h2 className="text-xl font-semibold">Page Scanner</h2>

            <Input
            placeholder="Enter page URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading && url.trim()) {
                scanPage();
              }
            }}
            />

            <Button onClick={scanPage} disabled={loading || !url}>
              {loading ? "Scanning..." : "Scan Page"}
            </Button>

            {screenshot && (
            <img
                src={`data:image/png;base64,${screenshot}`}
                alt="Page screenshot"
                className="border rounded max-w-full h-auto"
                style={{ width: "600px" }} // increase display width
            />
            )}

            {/* {autoTests.length > 0 && (
            <div>
                <h3 className="font-medium mt-4">Auto-Generated Tests</h3>
                <ul className="list-disc pl-6">
                {autoTests.map((t, i) => (
                    <li key={i}>{t}</li>
                ))}
                </ul>
            </div>
            )} */}
        </div>

        {/* RIGHT SIDE — AI Chat + Test Summary */}
        <div className="flex flex-col w-2/3 p-6 space-y-4">

          <h2 className="text-xl font-semibold">AI Test Creation</h2>

          {/* AI OUTPUT WINDOW (Chat-like box) */}
          <div className="border rounded-lg bg-gray-50 p-4 h-full overflow-y-auto shadow-inner">
            {loading ? (
              <div className="space-y-4">
                {progress && (
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">
                        {progress.stage === 'scanning' && '🔍 Scanning Page'}
                        {progress.stage === 'analyzing' && '🧠 Analyzing Structure'}
                        {progress.stage === 'generating' && '⚡ Generating Tests'}
                        {progress.stage === 'complete' && '✅ Complete'}
                      </h3>
                      <span className="text-sm text-gray-500">{progress.percent}%</span>
                    </div>
                    <Progress value={progress.percent} className="mb-2" />
                    <p className="text-sm text-gray-600">{progress.message}</p>
                  </div>
                )}
                <LoadingState
                  message="This may take a minute..."
                  showSkeleton={false}
                />
              </div>
            ) : aiTests.length > 0 || aiSummary ? (
              <div className="space-y-6">
                {/* Summary Section */}
                {aiSummary && (
                  <section className={`bg-white border rounded-lg p-4 shadow-sm ${hasError ? "border-red-300 bg-red-50" : ""}`}>
                    <h3 className={`font-semibold text-lg mb-2 ${hasError ? "text-red-800" : "text-gray-800"}`}>
                      {hasError ? "⚠️ Error" : "Summary"}
                    </h3>
                    <div className={`text-sm leading-relaxed whitespace-pre-wrap ${hasError ? "text-red-700" : "text-gray-700"}`}>
                      {typeof aiSummary === "string" ? aiSummary : String(aiSummary)}
                    </div>
                  </section>
                )}

                {/* Tests Sections */}
                {aiTests.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800">
                          Generated Tests ({aiTests.length})
                        </h3>
                        {testSources && (testSources.general > 0 || testSources.elements > 0) && (
                          <p className="text-xs text-gray-500 mt-1">
                            {testSources.general > 0 && `${testSources.general} general`}
                            {testSources.general > 0 && testSources.elements > 0 && " + "}
                            {testSources.elements > 0 && `${testSources.elements} element-specific`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {newTestsAdded && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                            +{aiTests.length - previousTestsCount} new tests appended
                          </span>
                        )}
                        {previousTestsCount > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (confirm("Clear all stored tests for this URL?")) {
                                try {
                                  // For now, we can't easily delete from database via frontend
                                  // So we'll clear local state and rely on database cleanup
                                  setAiTests([]);
                                  setAiSummary("");
                                  setPreviousTestsCount(0);
                                  setNewTestsAdded(false);
                                  setTestSources(null);
                                } catch (error) {
                                  console.error("Error clearing tests:", error);
                                }
                              }
                            }}
                            className="text-xs"
                          >
                            Clear Stored
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      {aiTests.map((test, i) => (
                        <div key={i} className="bg-white border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                          <div className="mb-3">
                            <h4 className="font-semibold text-base text-gray-900 mb-1">
                              {typeof test.title === "string" ? test.title : test.title ? String(test.title) : `Test ${i + 1}`}
                            </h4>
                            {test.why && (
                              <p className="text-sm text-gray-600 italic">
                                {typeof test.why === "string" ? test.why : String(test.why)}
                              </p>
                            )}
                          </div>

                          {test.steps && test.steps.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-500 mb-1">Steps:</p>
                              <ol className="list-decimal list-inside text-xs text-gray-700 space-y-1">
                                {test.steps.map((step: any, stepIdx: number) => (
                                  <li key={stepIdx}>
                                    {typeof step === "string" ? step : JSON.stringify(step)}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {test.code && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-2">Cypress Code:</p>
                              <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                                <code>
                                  {(() => {
                                    if (typeof test.code === "string") {
                                      return test.code;
                                    }
                                    // If it's an object, try to format it nicely
                                    if (typeof test.code === "object") {
                                      return JSON.stringify(test.code, null, 2);
                                    }
                                    return String(test.code);
                                  })()}
                                </code>
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-sm text-center">
                  AI-generated test descriptions will appear here after you scan a page.
                </p>
              </div>
            )}
          </div>

          {/* USER DESCRIPTION TEXTAREA (Auto-expanding like ChatGPT) */}
          <textarea
            placeholder="Tell the AI what this page does, what users should be able to do, or what edge cases matter..."
            value={analysis}
            onChange={(e) => {
              setAnalysis(e.target.value);

              // Auto-expand height logic
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            className="
              w-full 
              min-h-[48px] 
              max-h-[300px]
              resize-none 
              rounded-xl 
              overflow-hidden
              border 
              border-gray-300 
              p-3 
              text-base 
              leading-6 
              focus:outline-none 
              focus:ring-2 
              focus:ring-black 
              bg-white
              shadow-sm
              transition-all
            "
            rows={1}
          />

          {/* BUTTON MATCHING CHATGPT STYLE */}
          <Button className="w-44 text-base rounded-lg shadow-sm mt-3">
            Generate Tests
          </Button>

        </div>

        </div>
    </div>
  );
}
