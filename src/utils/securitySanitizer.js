/**
 * Security Sanitizer & Injection Guard
 * 
 * Protects against:
 * 1. SQL Injection (SQLi) - union-based, boolean-based, comment truncation, stacked queries
 * 2. NoSQL Injection - MongoDB operator injection ($ne, $gt, $where, $regex, $or)
 * 3. Parameter Pollution and Type Confusion
 */

// Regex matching common SQL injection signatures
const SQL_INJECTION_PATTERN = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|UNION|MERGE|TRUNCATE)\b|\bOR\b\s+['"\d\w]+\s*=\s*['"\d\w]+|--|;|\/\*|\*\/)/i;

// Regex matching MongoDB / NoSQL operator keys
const NOSQL_KEY_PATTERN = /^\$|\./;

/**
 * Validates that an email is a clean, well-formed string (preventing SQL/NoSQL injection in auth)
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  
  // Strict standard email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * Checks whether a given string contains suspicious SQL injection vectors
 */
export function containsSqlInjection(str) {
  if (typeof str !== 'string') return false;
  return SQL_INJECTION_PATTERN.test(str);
}

/**
 * Sanitizes an ID (e.g. taskId, boardId) to ensure it is strictly a safe alphanumeric string
 */
export function sanitizeId(id) {
  if (id === null || id === undefined) return '';
  return String(id).replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 128);
}

/**
 * Deeply sanitizes an object or value to strip NoSQL operators (keys starting with $)
 * and remove dangerous injection characters.
 */
export function sanitizeForStorage(data, seen = new WeakSet()) {
  if (data === null || data === undefined) {
    return data;
  }

  // Primitive types
  if (typeof data === 'boolean' || typeof data === 'number') {
    return data;
  }

  if (typeof data === 'string') {
    // Strip null byte injections
    return data.replace(/\0/g, '');
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForStorage(item, seen));
  }

  // Handle objects
  if (typeof data === 'object') {
    if (seen.has(data)) return null;
    seen.add(data);

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      // Reject / strip any key starting with '$' (NoSQL operator injection) or containing '.' (field traversing)
      if (NOSQL_KEY_PATTERN.test(key)) {
        continue;
      }
      sanitized[key] = sanitizeForStorage(value, seen);
    }
    return sanitized;
  }

  return data;
}

/**
 * Prepares and sanitizes user authentication credentials
 */
export function sanitizeAuthCredentials({ email, password, rememberMe }) {
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new Error('Invalid input: email and password must be strings');
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    throw new Error('Invalid email format');
  }

  // Strip null bytes from password
  const cleanPassword = password.replace(/\0/g, '');
  if (cleanPassword.length === 0) {
    throw new Error('Password cannot be empty');
  }

  return {
    email: cleanEmail,
    password: cleanPassword,
    rememberMe: Boolean(rememberMe)
  };
}

