import { NextResponse } from "next/server";
import OpenAI from "openai";
import { sanitizeRequest, globalRateLimiter } from "@/lib/validation";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
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

    const { url, userDescription } = sanitized;
    const htmlElements = body.htmlElements; // Additional validation for HTML elements

    if (!htmlElements || !Array.isArray(htmlElements) || htmlElements.length === 0) {
      return NextResponse.json(
        { summary: "No HTML elements provided or invalid format", tests: [] },
        { status: 400 }
      );
    }

    // Limit HTML elements to prevent abuse
    const limitedHtmlElements = htmlElements.slice(0, 50);

    // Build HTML elements summary for the prompt
    const elementsSummary = limitedHtmlElements.map((el: any, idx: number) => {
      const attrs = Object.entries(el.attributes || {})
        .filter(([key]) => !['class', 'id', 'name', 'type', 'href', 'placeholder'].includes(key))
        .slice(0, 3) // Limit attributes to prevent prompt bloat
        .map(([key, value]) => `${key}="${String(value).substring(0, 50)}"`) // Limit attribute values
        .join(' ');

      return `${idx + 1}. ${el.type?.toUpperCase() || 'ELEMENT'}: ${el.html?.substring(0, 200) || 'N/A'}${attrs ? ` (${attrs})` : ''}`;
    }).join('\n');

    const prompt = `You are a QA automation engineer. Generate specific Cypress tests for interactive HTML elements.

URL: ${url}

User notes: "${userDescription || "No specific requirements provided."}"

HTML ELEMENTS FOUND:
${elementsSummary}

Generate Cypress tests that:
1. Test each button's click functionality
2. Test form inputs (typing, validation, submission)
3. Test link navigation
4. Test element visibility and interactivity
5. Use proper selectors (prefer data-cy, id, name, or text content)
6. Include assertions to verify expected behavior

Focus on element-specific interactions rather than full user flows.

CYPRESS EXAMPLES:
describe('Button Interactions', () => {
  it('should click button and verify action', () => {
    cy.visit('${url}');
    cy.get('button#submit-btn').should('be.visible').click();
    cy.get('.success-message').should('be.visible');
  });
});

describe('Form Inputs', () => {
  it('should type in input field', () => {
    cy.visit('${url}');
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="email"]').should('have.value', 'test@example.com');
  });
});

Return **ONLY valid JSON**, no markdown or explanations.
JSON format:
{
  "summary": "Brief summary of interactive elements and tests generated",
  "tests": [
    {
      "title": "Test name for specific element",
      "why": "Why this element test is important",
      "steps": ["step1", "step2"],
      "code": "Complete Cypress test code"
    }
  ]
}`;

    // Helper function to try multiple JSON parsing strategies
    const tryParseJSON = (text: string, finishReason: string): { success: boolean; data?: any; error?: string } => {
      const strategies = [
        () => {
          const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
          if (jsonMatch) return jsonMatch[1];
          return null;
        },
        () => {
          const firstBrace = text.indexOf('{');
          const lastBrace = text.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            return text.substring(firstBrace, lastBrace + 1);
          }
          return null;
        },
        () => {
          const jsonMatch = text.match(/(\{[\s\S]*\})/);
          return jsonMatch ? jsonMatch[1] : null;
        },
        () => text.trim(),
      ];

      for (const strategy of strategies) {
        try {
          let jsonString = strategy();
          if (!jsonString) continue;

          if (finishReason === "length") {
            const openBraces = (jsonString.match(/\{/g) || []).length;
            const closeBraces = (jsonString.match(/\}/g) || []).length;
            const openBrackets = (jsonString.match(/\[/g) || []).length;
            const closeBrackets = (jsonString.match(/\]/g) || []).length;
            
            if (openBraces > closeBraces) {
              for (let i = 0; i < openBraces - closeBraces; i++) {
                const lastQuote = jsonString.lastIndexOf('"');
                const lastComma = jsonString.lastIndexOf(',');
                if (lastQuote > lastComma && (jsonString.match(/"/g) || []).length % 2 !== 0) {
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

          jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
          const parsed = JSON.parse(jsonString);
          
          if (typeof parsed === 'object' && parsed !== null) {
            if (!parsed.tests || !Array.isArray(parsed.tests)) {
              parsed.tests = [];
            }
            return { success: true, data: parsed };
          }
        } catch (parseErr) {
          continue;
        }
      }

      return { success: false, error: "All parsing strategies failed" };
    };

    // Retry function
    let lastResponseText = "";
    const callAIWithRetry = async (attempt: number = 1, useStrictPrompt: boolean = false): Promise<any> => {
      const maxRetries = 2; // Fewer retries for element tests
      const retryPrompt = useStrictPrompt ? `${prompt}

CRITICAL: Return ONLY valid JSON. No explanations, no markdown.` : prompt;

      try {
        const response = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL || "baidu/ernie-4.5-21b-a3b",
          messages: [
            {
              role: "user",
              content: retryPrompt,
            },
          ],
          max_tokens: parseInt(process.env.MAX_TOKENS || "3000"),
          temperature: attempt === 1 ? 0.7 : 0.3,
        });

        const text = response.choices[0].message?.content || "";
        lastResponseText = text;
        const finishReason = response.choices[0].finish_reason;
        console.log(`Element Tests AI Response (attempt ${attempt}):`, text.substring(0, 200));

        const parseResult = tryParseJSON(text, finishReason);
        
        if (parseResult.success && parseResult.data) {
          const aiData = parseResult.data;
          if (finishReason === "length") {
            aiData.summary = (aiData.summary || "") + 
              "\n\n⚠️ Note: Response was truncated.";
          }
          return aiData;
        }

        if (attempt < maxRetries) {
          console.log(`Element tests parsing failed on attempt ${attempt}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          return callAIWithRetry(attempt + 1, true);
        }

        throw new Error("Failed to parse after all retries");
      } catch (err) {
        if (attempt < maxRetries && !(err instanceof Error && err.message.includes("Failed to parse"))) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          return callAIWithRetry(attempt + 1, useStrictPrompt);
        }
        throw err;
      }
    };

    const aiData = await callAIWithRetry();
    return NextResponse.json(aiData);
  } catch (err) {
    console.error("Error generating element tests:", err);
    return NextResponse.json(
      {
        summary: `Error generating element tests: ${err instanceof Error ? err.message : "Unknown error"}`,
        tests: [],
        _error: true,
      },
      { status: 500 }
    );
  }
}

