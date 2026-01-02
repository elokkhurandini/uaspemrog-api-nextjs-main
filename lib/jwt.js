/**
 * JWT Utilities
 * 
 * Functions untuk generate dan verify JWT tokens
 */

import jwt from 'jsonwebtoken';

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Validate environment variables
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be defined in environment variables');
}

/**
 * Generate Access Token
 * 
 * @param {Object} payload - { id, email, role }
 * @returns {string} JWT Access Token
 */
export function generateAccessToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      type: 'access'
    },
    JWT_SECRET,
    {
      expiresIn: JWT_ACCESS_EXPIRES_IN,
      issuer: 'todo-api',
      audience: 'todo-app'
    }
  );
}

/**
 * Generate Refresh Token
 * 
 * @param {Object} payload - { id }
 * @returns {string} JWT Refresh Token
 */
export function generateRefreshToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      type: 'refresh'
    },
    JWT_REFRESH_SECRET,
    {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'todo-api',
      audience: 'todo-app'
    }
  );
}

/**
 * Generate Both Tokens
 * 
 * @param {Object} payload - User data
 * @returns {Object} { accessToken, refreshToken }
 */
export function generateTokens(payload) {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken({ id: payload.id })
  };
}

/**
 * Verify Access Token
 * 
 * @param {string} token - JWT token
 * @returns {Object} Decoded payload
 * @throws {Error} If token invalid or expired
 */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'todo-api',
      audience: 'todo-app'
    });

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      throw error;
    }
  }
}

/**
 * Verify Refresh Token
 * 
 * @param {string} token - Refresh token
 * @returns {Object} Decoded payload
 * @throws {Error} If token invalid or expired
 */
export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'todo-api',
      audience: 'todo-app'
    });

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    } else {
      throw error;
    }
  }
}

/**
 * Decode Token (tanpa verifikasi)
 * 
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload atau null
 */
export function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
}

/**
 * Extract Token dari Authorization Header
 * 
 * @param {string} authHeader - Header Authorization
 * @returns {string|null} Token atau null
 */
export function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Check if Token is Expired
 * 
 * @param {string} token - JWT token
 * @returns {boolean} true jika expired
 */
export function isTokenExpired(token) {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/**
 * Get Token Expiration Time
 * 
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date atau null
 */
export function getTokenExpiration(token) {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return null;
    return new Date(decoded.exp * 1000);
  } catch {
    return null;
  }
}