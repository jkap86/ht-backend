import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiting configuration for authentication endpoints
 * Prevents brute force attacks by limiting requests per IP
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests, not just failed ones
  keyGenerator: (req: Request) => {
    // Use IP address as the key for rate limiting
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many login attempts from this IP, please try again after 15 minutes',
      retryAfter: 15 * 60, // seconds
    });
  },
});

/**
 * Rate limiting for registration endpoint
 * More restrictive to prevent spam account creation
 */
export const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  message: 'Too many accounts created from this IP, please try again after an hour',
  skipSuccessfulRequests: false,
});

/**
 * Rate limiting for password reset/refresh token endpoints
 */
export const refreshTokenRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 refresh attempts per 5 minutes
  message: 'Too many refresh token requests, please try again later',
  skipSuccessfulRequests: true, // Only count failed requests
});

/**
 * General API rate limit for authenticated users
 * More generous limits for regular API usage
 */
export const generalApiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: 'Too many requests from this IP, please slow down',
  skipSuccessfulRequests: false,
});

/**
 * Rate limiting for chat messages
 * Prevents spam in chat rooms
 */
export const chatRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit to 30 messages per minute
  message: 'You are sending messages too quickly. Please slow down.',
  skipSuccessfulRequests: false,
});

/**
 * Rate limiting for draft actions
 * Prevents rapid-fire draft picks
 */
export const draftActionRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit to 20 draft actions per minute
  message: 'Too many draft actions. Please slow down.',
  skipSuccessfulRequests: false,
});