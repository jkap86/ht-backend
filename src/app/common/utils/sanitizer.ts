import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Create a window object for DOMPurify to use
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

/**
 * Sanitize user input to prevent XSS attacks
 * Removes dangerous HTML and JavaScript
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Configure DOMPurify - very strict for chat messages
  const config = {
    ALLOWED_TAGS: [], // No HTML tags allowed in chat
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // Keep text content
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  };

  // Clean the input
  const cleaned = purify.sanitize(input, config);

  // Additional sanitization for common XSS patterns
  const sanitized = cleaned
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove any script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/[<>]/g, (match) => {
      // Escape remaining angle brackets
      return match === '<' ? '&lt;' : '&gt;';
    })
    .trim();

  return sanitized;
}

/**
 * Sanitize HTML content with limited allowed tags
 * Use this for rich text content where some HTML is allowed
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Configure DOMPurify - allow some formatting tags
  const config = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'p', 'br', 'span'],
    ALLOWED_ATTR: ['class'], // Only allow class attribute
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    KEEP_CONTENT: true,
  };

  return purify.sanitize(html, config);
}

/**
 * Sanitize JSON data to prevent injection attacks
 * Ensures the JSON string doesn't contain executable code
 */
export function sanitizeJson(jsonString: string): object | null {
  try {
    const parsed = JSON.parse(jsonString);

    // Recursively sanitize string values in the object
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return sanitizeInput(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      if (obj !== null && typeof obj === 'object') {
        const sanitized: any = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            // Sanitize the key as well
            const safeKey = sanitizeInput(key);
            sanitized[safeKey] = sanitizeObject(obj[key]);
          }
        }
        return sanitized;
      }
      return obj;
    };

    return sanitizeObject(parsed);
  } catch (error) {
    console.error('Invalid JSON string provided to sanitizer');
    return null;
  }
}

/**
 * Validate and sanitize username
 * Ensures username contains only allowed characters
 */
export function sanitizeUsername(username: string): string {
  if (!username || typeof username !== 'string') {
    return '';
  }

  // Remove any non-alphanumeric characters except underscore
  // This matches the validation in the User domain model
  return username.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20);
}

/**
 * Sanitize SQL-like input to prevent SQL injection
 * Note: This is a backup - always use parameterized queries!
 */
export function sanitizeSqlInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove or escape dangerous SQL characters
  return input
    .replace(/['";\\]/g, '') // Remove quotes and backslash
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove multi-line comment start
    .replace(/\*\//g, '') // Remove multi-line comment end
    .replace(/\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|EXEC|EXECUTE)\b/gi, '') // Remove SQL keywords
    .trim();
}

/**
 * Sanitize file paths to prevent directory traversal attacks
 */
export function sanitizeFilePath(path: string): string {
  if (!path || typeof path !== 'string') {
    return '';
  }

  // Remove directory traversal patterns
  return path
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[\/\\]+/g, '/') // Normalize slashes
    .replace(/^[\/\\]/, ''); // Remove leading slash
}

/**
 * Sanitize URLs to prevent open redirect vulnerabilities
 */
export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    // Check for suspicious patterns
    if (url.includes('javascript:') || url.includes('data:') || url.includes('vbscript:')) {
      return null;
    }

    return parsed.toString();
  } catch (error) {
    // Invalid URL
    return null;
  }
}

/**
 * Batch sanitize multiple inputs
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  fieldsToSanitize: (keyof T)[]
): T {
  const sanitized = { ...obj };

  for (const field of fieldsToSanitize) {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeInput(sanitized[field] as string) as T[typeof field];
    }
  }

  return sanitized;
}