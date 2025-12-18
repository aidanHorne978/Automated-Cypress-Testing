// Input validation and security utilities for TestFlow AI

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: string;
}

export interface SanitizedInput {
  url: string;
  userDescription: string;
  screenshot?: string;
  domData?: any;
  htmlElements?: any[];
  isValid: boolean;
  errors: string[];
}

// URL validation and security
export function validateUrl(url: string): ValidationResult {
  try {
    // Basic format check
    if (!url || typeof url !== 'string') {
      return { isValid: false, error: 'URL is required and must be a string' };
    }

    const trimmedUrl = url.trim();

    // Length check
    if (trimmedUrl.length > 2048) {
      return { isValid: false, error: 'URL is too long (max 2048 characters)' };
    }

    // Parse URL
    const parsedUrl = new URL(trimmedUrl);

    // Protocol validation
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { isValid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }

    // Block localhost and private IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsedUrl.hostname.toLowerCase();

      // Block localhost and common local development addresses
      const blockedHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1'
      ];

      if (blockedHosts.includes(hostname)) {
        return { isValid: false, error: 'Localhost URLs are not allowed in production' };
      }

      // Block private IP ranges
      if (isPrivateIP(hostname)) {
        return { isValid: false, error: 'Private IP addresses are not allowed' };
      }

      // Block common internal hostnames
      const internalHosts = [
        'internal',
        'intranet',
        'corp',
        'company',
        'enterprise'
      ];

      if (internalHosts.some(host => hostname.includes(host))) {
        return { isValid: false, error: 'Internal network URLs are not allowed' };
      }
    }

    // Additional security checks
    const suspiciousPatterns = [
      /\.\./,  // Directory traversal
      /[<>'"]/, // HTML injection
      /javascript:/i, // JavaScript URLs
      /data:/i, // Data URLs (except for our base64 images)
      /vbscript:/i, // VBScript URLs
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(trimmedUrl)) {
        return { isValid: false, error: 'URL contains potentially malicious content' };
      }
    }

    return { isValid: true, sanitizedValue: trimmedUrl };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

// Check if IP is in private ranges
function isPrivateIP(hostname: string): boolean {
  try {
    const ip = hostname;
    const parts = ip.split('.');

    if (parts.length !== 4) return false;

    const [a, b, c] = parts.map(Number);

    // 10.0.0.0/8
    if (a === 10) return true;

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;

    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;

    return false;
  } catch {
    return false;
  }
}

// User description validation and sanitization
export function validateUserDescription(description: string): ValidationResult {
  try {
    if (!description || typeof description !== 'string') {
      return { isValid: true, sanitizedValue: '' }; // Optional field
    }

    const trimmed = description.trim();

    // Length check
    if (trimmed.length > 10000) {
      return { isValid: false, error: 'Description is too long (max 10,000 characters)' };
    }

    // Basic sanitization - remove potentially dangerous characters
    let sanitized = trimmed
      .replace(/[<>\"'`]/g, '') // Remove HTML/script injection chars
      .replace(/\\/g, '') // Remove backslashes
      .replace(/\u0000/g, '') // Remove null bytes
      .trim();

    // Check for excessive whitespace
    if (sanitized.length < trimmed.length * 0.5) {
      return { isValid: false, error: 'Description contains too many invalid characters' };
    }

    return { isValid: true, sanitizedValue: sanitized };
  } catch (error) {
    return { isValid: false, error: 'Invalid description format' };
  }
}

// Comprehensive input sanitization
export function sanitizeRequest(body: any): SanitizedInput {
  const errors: string[] = [];
  let url = '';
  let userDescription = '';

  // Validate and sanitize URL
  if (body.url !== undefined) {
    const urlValidation = validateUrl(body.url);
    if (urlValidation.isValid) {
      url = urlValidation.sanitizedValue!;
    } else {
      errors.push(`URL: ${urlValidation.error}`);
    }
  } else {
    errors.push('URL: URL is required');
  }

  // Validate and sanitize user description
  if (body.userDescription !== undefined) {
    const descValidation = validateUserDescription(body.userDescription);
    if (descValidation.isValid) {
      userDescription = descValidation.sanitizedValue!;
    } else {
      errors.push(`Description: ${descValidation.error}`);
    }
  }

  // Additional security checks
  if (body.screenshot) {
    // Validate base64 image data
    if (typeof body.screenshot !== 'string' || !body.screenshot.startsWith('data:image/png;base64,')) {
      errors.push('Screenshot: Invalid screenshot format');
    }

    // Check size (base64 is ~33% larger than binary)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (body.screenshot.length > maxSize * 1.5) {
      errors.push('Screenshot: Screenshot is too large');
    }
  }

  return {
    url,
    userDescription,
    screenshot: body.screenshot,
    domData: body.domData,
    htmlElements: body.htmlElements,
    isValid: errors.length === 0,
    errors
  };
}

// Rate limiting helper
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getResetTime(identifier: string): number {
    const requests = this.requests.get(identifier) || [];
    if (requests.length === 0) return 0;

    const oldestRequest = Math.min(...requests);
    return oldestRequest + this.windowMs;
  }
}

// Export singleton rate limiter (per IP for production)
export const globalRateLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10') // 10 requests per minute
);
