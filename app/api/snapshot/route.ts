import { NextResponse } from "next/server";
import playwright from "playwright";
import { sanitizeRequest, globalRateLimiter } from "@/lib/validation";

export async function POST(req: Request) {
  let browser;
  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') ||
                     req.headers.get('x-real-ip') ||
                     'unknown';
    if (!globalRateLimiter.isAllowed(clientIP)) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          resetTime: globalRateLimiter.getResetTime(clientIP)
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const sanitized = sanitizeRequest(body);

    if (!sanitized.isValid) {
      return NextResponse.json(
        { error: "Validation failed", details: sanitized.errors },
        { status: 400 }
      );
    }

    const { url } = sanitized;

    browser = await playwright.chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1200 }, // larger resolution
    });

    await page.goto(url, { waitUntil: "networkidle" });

    // Take screenshot
    const buffer = await page.screenshot({ type: "png", fullPage: true });
    const screenshot = buffer.toString("base64");

    // Extract DOM data for text-only models
    const title = await page.title();
    const headings = await page.$$eval("h1, h2, h3", els =>
      els.map(e => e.textContent?.trim()).filter(Boolean)
    );
    const buttons = await page.$$eval("button, [role='button'], input[type='submit']", els =>
      els.map(e => e.textContent?.trim() || e.getAttribute("value")).filter(Boolean)
    );
    const inputs = await page.$$eval("input, textarea, select", els =>
      els.map(e => ({
        name: e.getAttribute("name") || e.getAttribute("id") || "",
        type: e.getAttribute("type") || e.tagName.toLowerCase(),
        placeholder: e.getAttribute("placeholder") || ""
      })).filter(el => el.name || el.placeholder)
    );
    const links = await page.$$eval("a[href]", els =>
      els.map(e => ({
        text: e.textContent?.trim() || "",
        href: e.getAttribute("href") || ""
      })).filter(el => el.text && el.href).slice(0, 20) // Limit to first 20 links
    );

    // Extract HTML for interactive elements (buttons, forms, inputs, links)
    const interactiveElementsHTML = await page.evaluate(() => {
      const elements: any[] = [];
      
      // Get all buttons with their HTML
      document.querySelectorAll("button, [role='button'], input[type='submit'], input[type='button']").forEach((el, idx) => {
        if (idx < 30) { // Limit to 30 buttons
          elements.push({
            type: 'button',
            html: el.outerHTML.substring(0, 500), // Limit HTML length
            text: el.textContent?.trim() || el.getAttribute("value") || "",
            id: el.id || "",
            className: el.className || "",
            attributes: Array.from(el.attributes).reduce((acc: any, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {})
          });
        }
      });
      
      // Get all form inputs
      document.querySelectorAll("input, textarea, select").forEach((el, idx) => {
        if (idx < 30) { // Limit to 30 inputs
          elements.push({
            type: el.tagName.toLowerCase(),
            html: el.outerHTML.substring(0, 500),
            name: el.getAttribute("name") || el.id || "",
            inputType: el.getAttribute("type") || "",
            placeholder: el.getAttribute("placeholder") || "",
            attributes: Array.from(el.attributes).reduce((acc: any, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {})
          });
        }
      });
      
      // Get all links
      document.querySelectorAll("a[href]").forEach((el, idx) => {
        if (idx < 30) { // Limit to 30 links
          elements.push({
            type: 'link',
            html: el.outerHTML.substring(0, 500),
            text: el.textContent?.trim() || "",
            href: el.getAttribute("href") || "",
            attributes: Array.from(el.attributes).reduce((acc: any, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {})
          });
        }
      });
      
      return elements;
    });

    const domData = {
      title,
      headings,
      buttons,
      inputs,
      links
    };

    console.log("Screenshot length:", screenshot.length);
    console.log("Interactive elements found:", interactiveElementsHTML.length);

    return NextResponse.json({ 
      screenshot, 
      domData,
      htmlElements: interactiveElementsHTML 
    });
  } catch (err) {
    console.error("Snapshot API error:", err);
    return NextResponse.json({ error: "Failed to load page" }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
