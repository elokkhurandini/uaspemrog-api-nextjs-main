
import { decodeToken } from '../jwt.js';

// Color codes untuk terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * Format Date
 */
function formatDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Get Client IP Address
 */
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cloudflareIP = request.headers.get('cf-connecting-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (cloudflareIP) return cloudflareIP;
  if (realIP) return realIP;

  return 'unknown';
}

/**
 * Get User ID dari Token
 */
function getUserIdFromRequest(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = decodeToken(token);

    return decoded?.id || null;
  } catch {
    return null;
  }
}

/**
 * Format Log Message dengan Warna
 */
function formatLogMessage(logData) {
  const { timestamp, method, path, ip, userId, duration, status } = logData;

  let statusColor = colors.green;
  if (status >= 400 && status < 500) statusColor = colors.yellow;
  if (status >= 500) statusColor = colors.red;

  let methodColor = colors.blue;
  if (method === 'POST') methodColor = colors.green;
  if (method === 'PUT' || method === 'PATCH') methodColor = colors.yellow;
  if (method === 'DELETE') methodColor = colors.red;

  const parts = [
    `${colors.gray}[${timestamp}]${colors.reset}`,
    `${methodColor}${method}${colors.reset}`,
    `${colors.bright}${path}${colors.reset}`,
    `${colors.cyan}${ip}${colors.reset}`,
    userId ? `${colors.dim}User:${userId}${colors.reset}` : '',
    `${statusColor}${status}${colors.reset}`,
    `${colors.dim}${duration}ms${colors.reset}`
  ];

  return parts.filter(Boolean).join(' ');
}

/**
 * Format Simple Log
 */
function formatSimpleLog(logData) {
  const { timestamp, method, path, ip, userId, duration, status } = logData;
  const userInfo = userId ? ` User:${userId}` : '';
  return `[${timestamp}] ${method} ${path} ${ip}${userInfo} ${status} ${duration}ms`;
}

/**
 * Logging Middleware
 * 
 * @param {Request} request - Next.js request
 * @param {Function} handler - Route handler
 * @returns {Response}
 */
export async function withLogging(request, handler) {
  const startTime = Date.now();
  const timestamp = formatDate(new Date());
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;
  const ip = getClientIP(request);
  const userId = getUserIdFromRequest(request);

  console.log(`${colors.dim}→${colors.reset} Incoming request: ${method} ${path}`);

  let status = 200;

  try {
    const response = await handler(request);
    status = response.status;

    const duration = Date.now() - startTime;

    const logData = {
      timestamp,
      method,
      path,
      ip,
      userId,
      duration,
      status
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(formatLogMessage(logData));
    } else {
      console.log(formatSimpleLog(logData));
    }

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    status = 500;

    console.error(`[${timestamp}] ERROR ${method} ${path} ${ip} ${duration}ms`);
    console.error('Error details:', error);

    throw error;
  }
}