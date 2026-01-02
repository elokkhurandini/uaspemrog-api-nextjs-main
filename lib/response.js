/**
 * Response Utilities
 * 
 * Helper functions untuk membuat response API yang konsisten
 */

import { NextResponse } from 'next/server';

/**
 * Success Response
 * 
 * @param {*} data - Data yang akan dikirim
 * @param {string} message - Success message
 * @param {number} status - HTTP status code
 * @returns {NextResponse}
 */
export function successResponse(data = null, message = 'Success', status = 200) {
  return NextResponse.json(
    {
      success: true,
      message,
      data
    },
    { status }
  );
}

/**
 * Error Response
 * 
 * @param {string} error - Error message
 * @param {number} code - HTTP status code
 * @param {*} details - Optional details
 * @returns {NextResponse}
 */
export function errorResponse(error, code = 500, details = null) {
  const response = {
    success: false,
    error,
    code
  };

  if (details) {
    response.details = details;
  }

  return NextResponse.json(response, { status: code });
}

/**
 * Created Response (201)
 */
export function createdResponse(data, message = 'Resource created successfully') {
  return successResponse(data, message, 201);
}

/**
 * No Content Response (204)
 */
export function noContentResponse() {
  return new NextResponse(null, { status: 204 });
}

/**
 * Bad Request Response (400)
 */
export function badRequestResponse(message = 'Bad request', details = null) {
  return errorResponse(message, 400, details);
}

/**
 * Unauthorized Response (401)
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return errorResponse(message, 401);
}

/**
 * Forbidden Response (403)
 */
export function forbiddenResponse(message = 'Forbidden') {
  return errorResponse(message, 403);
}

/**
 * Not Found Response (404)
 */
export function notFoundResponse(message = 'Resource not found') {
  return errorResponse(message, 404);
}

/**
 * Conflict Response (409)
 */
export function conflictResponse(message = 'Conflict') {
  return errorResponse(message, 409);
}

/**
 * Validation Error Response (422)
 */
export function validationErrorResponse(errors) {
  return errorResponse('Validation failed', 422, errors);
}

/**
 * Too Many Requests Response (429)
 */
export function tooManyRequestsResponse(message = 'Too many requests', details = null) {
  return errorResponse(message, 429, details);
}

/**
 * Internal Server Error Response (500)
 */
export function internalServerErrorResponse(message = 'Internal server error', error = null) {
  if (error) {
    console.error('Internal Server Error:', error);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = isProduction ? message : (error?.message || message);

  return errorResponse(errorMessage, 500);
}

/**
 * Method Not Allowed Response (405)
 */
export function methodNotAllowedResponse(message = 'Method not allowed') {
  return errorResponse(message, 405);
}

/**
 * Paginated Response
 */
export function paginatedResponse(data, pagination, message = 'Success') {
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return NextResponse.json(
    {
      success: true,
      message,
      data,
      pagination: {
        ...pagination,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1
      }
    },
    { status: 200 }
  );
}

/**
 * Handle Async Route
 */
export function handleAsync(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('Route Error:', error);
      return internalServerErrorResponse('An unexpected error occurred', error);
    }
  };
}