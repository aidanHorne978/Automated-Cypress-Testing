import { NextResponse } from "next/server";
import OpenAI from "openai";
import { sanitizeRequest, globalRateLimiter } from "@/lib/validation";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL, // LM Studio local URL or OpenAI
});

export async function POST(req: Request) {
  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') ||
                     req.headers.get('x-real-ip') ||
                     'unknown';
    if (!globalRateLimiter.isAllowed(clientIP)) {
      return NextResponse.json(
        {
          summary: "Rate limit exceeded. Please try again later.",
          tests: [],
          resetTime: globalRateLimiter.getResetTime(clientIP)
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const sanitized = sanitizeRequest(body);

    if (!sanitized.isValid) {
      return NextResponse.json(
        {
          summary: `Validation failed: ${sanitized.errors.join(', ')}`,
          tests: []
        },
        { status: 400 }
      );
    }

    const { url, userDescription, screenshot, domData } = sanitized as any; 

    // Build prompt with DOM data for text-only models (like baidu/ernie-4.5-21b-a3b)
    const domInfo = domData ? `
Page Title: ${domData.title || "N/A"}

Headings found:
${domData.headings?.length > 0 ? domData.headings.map((h: string, i: number) => `  ${i + 1}. ${h}`).join("\n") : "  None"}

Buttons found:
${domData.buttons?.length > 0 ? domData.buttons.map((b: string, i: number) => `  ${i + 1}. "${b}"`).join("\n") : "  None"}

Input fields found:
${domData.inputs?.length > 0 ? domData.inputs.map((inp: any, i: number) => `  ${i + 1}. ${inp.name || inp.placeholder || "Unnamed"} (${inp.type})`).join("\n") : "  None"}

Links found (first 10):
${domData.links?.length > 0 ? domData.links.slice(0, 10).map((l: any, i: number) => `  ${i + 1}. "${l.text}" -> ${l.href}`).join("\n") : "  None"}
` : "No DOM data available.";

    // Cypress test examples and best practices
    const cypressExamples = `
CYPRESS TEST EXAMPLES AND BEST PRACTICES:

1. Basic Page Load Test:
describe('Page Load', () => {
  it('should load the page successfully', () => {
    cy.visit('${url}');
    cy.url().should('include', 'expected-path');
    cy.title().should('not.be.empty');
  });
});

2. Form Interaction Test:
describe('Form Submission', () => {
  it('should submit form with valid data', () => {
    cy.visit('${url}');
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', 'dashboard');
  });
});

3. Button Click Test:
describe('Button Interactions', () => {
  it('should click button and verify action', () => {
    cy.visit('${url}');
    cy.contains('button', 'Submit').should('be.visible').click();
    cy.get('.success-message').should('be.visible');
  });
});

4. Input Field Test:
describe('Input Fields', () => {
  it('should type and validate input', () => {
    cy.visit('${url}');
    cy.get('input[type="text"]').type('test input');
    cy.get('input[type="text"]').should('have.value', 'test input');
  });
});

5. Navigation Test:
describe('Navigation', () => {
  it('should navigate to different pages', () => {
    cy.visit('${url}');
    cy.get('a[href="/about"]').click();
    cy.url().should('include', '/about');
  });
});

BEST PRACTICES:
- Always use cy.visit() before interacting with elements
- Use data-cy attributes when possible: cy.get('[data-cy="submit-btn"]')
- Wait for elements: cy.get('.element').should('be.visible')
- Use .should() for assertions instead of .then()
- Test user flows, not just individual elements
- Include error cases and edge cases
- Use descriptive test names that explain what is being tested
- Group related tests in describe blocks
`;

    const prompt = `You are a QA automation engineer. Analyze the webpage structure and generate Cypress tests.

URL: ${url}

${domInfo}

User notes: "${userDescription || "No specific requirements provided."}"

${cypressExamples}

Based on the page structure above, identify:
- Visible UI elements (buttons, forms, links, navigation)
- User interactions that should be tested
- Critical user flows
- Edge cases to consider

Generate 3-5 comprehensive Cypress tests following the examples above. Each test should:
- Be complete and ready to run
- Use proper Cypress commands (cy.visit, cy.get, cy.contains, cy.click, cy.type, cy.should)
- Include assertions to verify expected behavior
- Follow the structure: describe() blocks for grouping, it() blocks for individual tests
- Use descriptive selectors (prefer data-cy, name, id, or text content)
- Test real user interactions and flows

Return **ONLY valid JSON**, do not include any markdown, code fences, or explanations.
JSON format:
{
  "summary": "Brief summary of what this page does and key testable features",
  "tests": [
    {
      "title": "Descriptive test name",
      "why": "Why this test is important",
      "steps": ["step1", "step2"],
      "code": "Complete Cypress test code with describe/it blocks using proper Cypress syntax"
    }
  ]
}`;

    // Helper function to try multiple JSON parsing strategies
    const tryParseJSON = (text: string, finishReason: string): { success: boolean; data?: any; error?: string } => {
      const strategies = [
        // Strategy 1: Extract JSON from markdown code blocks
        () => {
          const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
          if (jsonMatch) return jsonMatch[1];
          return null;
        },
        // Strategy 2: Find first { to last }
        () => {
          const firstBrace = text.indexOf('{');
          const lastBrace = text.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            return text.substring(firstBrace, lastBrace + 1);
          }
          return null;
        },
        // Strategy 3: Try to find JSON object with regex
        () => {
          const jsonMatch = text.match(/(\{[\s\S]*\})/);
          return jsonMatch ? jsonMatch[1] : null;
        },
        // Strategy 4: Use the whole text
        () => text.trim(),
      ];

      for (const strategy of strategies) {
        try {
          let jsonString = strategy();
          if (!jsonString) continue;

          // Try to fix incomplete JSON if truncated
          if (finishReason === "length") {
            const openBraces = (jsonString.match(/\{/g) || []).length;
            const closeBraces = (jsonString.match(/\}/g) || []).length;
            const openBrackets = (jsonString.match(/\[/g) || []).length;
            const closeBrackets = (jsonString.match(/\]/g) || []).length;
            
            if (openBraces > closeBraces) {
              for (let i = 0; i < openBraces - closeBraces; i++) {
                const lastQuote = jsonString.lastIndexOf('"');
                const lastComma = jsonString.lastIndexOf(',');
                if (lastQuote > lastComma) {
                  jsonString += '"';
                }
                jsonString += '}';
              }
            }
            if (openBrackets > closeBrackets) {
              for (let i = 0; i < openBrackets - closeBrackets; i++) {
                jsonString += ']';
              }
            }
          }

          // Try to fix common JSON issues
          // Remove trailing commas before } or ]
          jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
          
          // If truncated, try to close incomplete structures
          if (finishReason === "length") {
            const openBraces = (jsonString.match(/\{/g) || []).length;
            const closeBraces = (jsonString.match(/\}/g) || []).length;
            const openBrackets = (jsonString.match(/\[/g) || []).length;
            const closeBrackets = (jsonString.match(/\]/g) || []).length;
            
            if (openBraces > closeBraces) {
              for (let i = 0; i < openBraces - closeBraces; i++) {
                // Check if we're in the middle of a string
                const lastQuote = jsonString.lastIndexOf('"');
                const lastComma = jsonString.lastIndexOf(',');
                if (lastQuote > lastComma && (jsonString.match(/"/g) || []).length % 2 !== 0) {
                  // We're in an unclosed string, close it first
                  jsonString += '"';
                }
                jsonString += '}';
              }
            }
            if (openBrackets > closeBrackets) {
              for (let i = 0; i < openBrackets - closeBrackets; i++) {
                jsonString += ']';
              }
            }
          }

          const parsed = JSON.parse(jsonString);
          
          // Validate structure
          if (typeof parsed === 'object' && parsed !== null) {
            if (!parsed.tests || !Array.isArray(parsed.tests)) {
              parsed.tests = [];
            }
            return { success: true, data: parsed };
          }
        } catch (parseErr) {
          // Try next strategy
          continue;
        }
      }

      return { success: false, error: "All parsing strategies failed" };
    };

    // Retry function with different approaches
    let lastResponseText = "";
    const callAIWithRetry = async (attempt: number = 1, useStrictPrompt: boolean = false): Promise<any> => {
      const maxRetries = 3;
      const retryPrompt = useStrictPrompt ? `${prompt}

CRITICAL: You MUST return ONLY valid JSON. No explanations, no markdown, no code fences. Start with { and end with }. The JSON must be parseable.` : prompt;

      try {
        const response = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL || "baidu/ernie-4.5-21b-a3b",
          messages: [
            {
              role: "user",
              content: retryPrompt,
            },
          ],
          max_tokens: parseInt(process.env.MAX_TOKENS || "4000"),
          temperature: attempt === 1 ? 0.7 : 0.3, // Lower temperature on retries for more consistent output
        });

        const text = response.choices[0].message?.content || "";
        lastResponseText = text; // Capture for error handling
        const finishReason = response.choices[0].finish_reason;
        console.log(`AI Response (attempt ${attempt}):`, text.substring(0, 200));
        console.log("Finish reason:", finishReason);

        // Try parsing with multiple strategies
        const parseResult = tryParseJSON(text, finishReason);
        
        if (parseResult.success && parseResult.data) {
          const aiData = parseResult.data;
          
          // If truncated, add a warning
          if (finishReason === "length") {
            aiData.summary = (aiData.summary || "") + 
              "\n\n⚠️ Note: Response was truncated. Some tests may be incomplete.";
          }
          
          return aiData;
        }

        // If parsing failed and we have retries left, try again
        if (attempt < maxRetries) {
          console.log(`Parsing failed on attempt ${attempt}, retrying with stricter prompt...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          return callAIWithRetry(attempt + 1, true);
        }

        // All retries failed, try to extract partial data
        throw new Error("Failed to parse after all retries");
      } catch (err) {
        if (attempt < maxRetries && !(err instanceof Error && err.message.includes("Failed to parse"))) {
          // If it's not a parsing error, retry
          console.log(`API call failed on attempt ${attempt}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          return callAIWithRetry(attempt + 1, useStrictPrompt);
        }
        throw err;
      }
    };

    // --- Call AI with retry logic ---
    let aiData;
    try {
      aiData = await callAIWithRetry();
    } catch (err) {
      console.error("Failed to parse AI response after all retries:", err);
      console.error("Last raw response:", lastResponseText.substring(0, 500));
      
      // Try to extract partial data from last response
      let partialData: any = { summary: "", tests: [] };
      try {
        // Try multiple regex patterns to extract summary
        const summaryPatterns = [
          /"summary"\s*:\s*"([^"]*)"/,
          /summary["\s:]+"([^"]*)"/i,
          /summary["\s:]+([^"]+)/i,
        ];
        
        for (const pattern of summaryPatterns) {
          const match = lastResponseText.match(pattern);
          if (match && match[1]) {
            partialData.summary = match[1];
            break;
          }
        }
        
        // Try to extract test titles
        const testTitlePatterns = [
          /"title"\s*:\s*"([^"]*)"/g,
          /title["\s:]+"([^"]*)"/gi,
        ];
        
        for (const pattern of testTitlePatterns) {
          const matches = lastResponseText.matchAll(pattern);
          for (const match of matches) {
            if (match[1] && !partialData.tests.find((t: any) => t.title === match[1])) {
              partialData.tests.push({
                title: match[1],
                why: "Test data incomplete - parsing failed",
                steps: [],
                code: "// Test code could not be parsed. Please try regenerating."
              });
            }
          }
          if (partialData.tests.length > 0) break;
        }
      } catch (extractErr) {
        console.error("Error extracting partial data:", extractErr);
      }
      
      // Build helpful error message
      const errorMessage = `⚠️ Failed to parse AI response after ${3} retry attempts. The model may not have returned valid JSON.${partialData.summary ? `\n\nPartial summary extracted: ${partialData.summary}` : ""}\n\nTroubleshooting:\n- The model may need more explicit JSON formatting instructions\n- Try increasing MAX_TOKENS if response was truncated\n- Check if the model supports JSON mode`;
      
      aiData = {
        summary: errorMessage,
        tests: partialData.tests.length > 0 ? partialData.tests : [],
        _error: true,
        _rawResponse: lastResponseText.substring(0, 1000) // Include first 1000 chars for debugging
      };
    }

    // --- Return JSON to frontend ---
    return NextResponse.json(aiData);
  } catch (err) {
    console.error("Error generating AI tests:", err);
    return NextResponse.json(
      {
        summary: `Error generating tests: ${err instanceof Error ? err.message : "Unknown error"}`,
        tests: [],
      },
      { status: 500 }
    );
  }
}
