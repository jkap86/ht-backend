import winston from 'winston';
import path from 'path';
import { env } from '../../config/env.config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston about our colors
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Define which transports to use based on environment
const transports: winston.transport[] = [];

// Always log to files
if (env.NODE_ENV !== 'test') {
  // Log all levels to combined.log
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Log only errors to error.log
  transports.push(
    new winston.transports.File({
      level: 'error',
      filename: path.join('logs', 'error.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// In development, also log to console
if (env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  format,
  transports,
  exitOnError: false, // Do not exit on handled exceptions
});

// Create a stream object for Morgan HTTP logger
export const stream = {
  write: (message: string) => {
    // Remove newline character at the end
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

export const logInfo = (message: string, context?: Record<string, any>) => {
  logger.info({
    message,
    ...context,
  });
};

export const logWarn = (message: string, context?: Record<string, any>) => {
  logger.warn({
    message,
    ...context,
  });
};

export const logDebug = (message: string, context?: Record<string, any>) => {
  logger.debug({
    message,
    ...context,
  });
};

export const logHttp = (message: string, context?: Record<string, any>) => {
  logger.http({
    message,
    ...context,
  });
};

// Performance logging
export const logPerformance = (operation: string, duration: number, context?: Record<string, any>) => {
  const level = duration > 1000 ? 'warn' : 'info';
  logger.log(level, {
    message: `Performance: ${operation}`,
    duration_ms: duration,
    ...context,
  });
};

// Database query logging
export const logQuery = (query: string, duration?: number, params?: any[]) => {
  logger.debug({
    message: 'Database query',
    query: query.substring(0, 500), // Truncate long queries
    duration_ms: duration,
    params: env.NODE_ENV === 'development' ? params : undefined, // Only log params in dev
  });
};

// API request logging
export const logApiRequest = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  userId?: string
) => {
  const level = statusCode >= 400 ? 'warn' : 'info';
  logger.log(level, {
    message: 'API Request',
    method,
    path,
    statusCode,
    duration_ms: duration,
    userId,
  });
};

// Socket event logging
export const logSocketEvent = (event: string, userId?: string, data?: any) => {
  logger.debug({
    message: 'Socket Event',
    event,
    userId,
    data: env.NODE_ENV === 'development' ? data : undefined, // Only log data in dev
  });
};

export default logger;