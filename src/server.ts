import express from "express";
import cors from "cors";
import { createServer } from "http";
import cron from "node-cron";
import swaggerUi from "swagger-ui-express";
import * as Sentry from "@sentry/node";

import { env } from "./config/env.config";
import { pool } from "./db/pool";
import { Container } from "./infrastructure/di/Container";
import { errorHandler } from "./app/common/middleware/error.middleware";
import { initializeSocketService } from "./app/runtime/socket/socket.service";
import { processExpiredDerbyPicks } from "./app/runtime/jobs/derby-autopick.service";
import { processExpiredDraftPicks } from "./app/runtime/jobs/draft-autopick.service";
import { syncPlayersFromSleeper } from "./app/runtime/jobs/player-sync.service";
import { swaggerSpec } from "./config/swagger.config";
import logger, { logInfo, logError, logWarn } from "./infrastructure/logger/Logger";

// Initialize Sentry for error monitoring (only in production)
if (env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: env.NODE_ENV,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: express() }),
    ],
    tracesSampleRate: 0.1, // 10% of requests will be traced
    beforeSend(event) {
      // Don't send sensitive data to Sentry
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.authorization;
      }
      return event;
    },
  });
  logInfo('Sentry error monitoring initialized');
}

// Initialize DI Container before loading routes
Container.initialize(pool);

const app = express();

// Sentry request handler (must be first)
if (env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
}

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // In development, allow any localhost port
    if (env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }

    // In production, use the configured URL
    if (env.FRONTEND_URL && origin === env.FRONTEND_URL) {
      return callback(null, true);
    }

    // Fallback for common development ports (only in development)
    if (env.NODE_ENV !== 'production') {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:64629',
        'http://localhost:8080',
        'http://localhost:4200'
      ];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
    }

    // Reject other origins
    logWarn(`CORS rejected origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// API Documentation (Swagger UI)
if (env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'HypeTrain API Documentation',
  }));
  logInfo('Swagger documentation available at /api-docs');
}

// Routes - import dynamically after container initialization
const router = require("./app/routes").default;
app.use("/api", router);

// Sentry error handler (must be before any other error middleware)
if (env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Global error handler (must be last middleware)
app.use(errorHandler);

const PORT = env.PORT;

// Create HTTP server and initialize Socket.IO
const server = createServer(app);
initializeSocketService(server);

server.listen(PORT, () => {
  logInfo(`Backend running on port ${PORT}`);
  logInfo(`WebSocket server initialized`);

  if (env.NODE_ENV !== 'production') {
    logInfo(`API Documentation available at http://localhost:${PORT}/api-docs`);
  }

  // Initialize derby auto-pick cron job (runs every 1 second for responsive timeouts)
  if (env.ENABLE_DERBY_AUTOPICK) {
    cron.schedule('*/1 * * * * *', async () => {
      await processExpiredDerbyPicks();
    });
    logInfo(`Derby auto-pick service initialized (checks every 1 second)`);
  } else {
    logInfo(`Derby auto-pick service disabled via ENABLE_DERBY_AUTOPICK=false`);
  }

  // Initialize draft auto-pick cron job (runs every 5 seconds for responsive timeouts)
  if (env.ENABLE_DRAFT_AUTOPICK) {
    cron.schedule('*/5 * * * * *', async () => {
      await processExpiredDraftPicks();
    });
    logInfo(`Draft auto-pick service initialized (checks every 5 seconds)`);
  } else {
    logInfo(`Draft auto-pick service disabled via ENABLE_DRAFT_AUTOPICK=false`);
  }

  // Initialize player sync cron job (runs every 12 hours)
  if (env.ENABLE_PLAYER_SYNC) {
    cron.schedule('0 */12 * * *', async () => {
      await syncPlayersFromSleeper();
    });
    logInfo(`Player sync service initialized (runs every 12 hours)`);
  } else {
    logInfo(`Player sync service disabled via ENABLE_PLAYER_SYNC=false`);
  }
});

// Graceful shutdown
const gracefulShutdown = () => {
  logInfo('Initiating graceful shutdown...');

  server.close(() => {
    logInfo('HTTP server closed');

    // Close database pool
    pool.end(() => {
      logInfo('Database pool closed');
      process.exit(0);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logError('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logError('Uncaught Exception:', { error: error.message, stack: error.stack });
  Sentry.captureException(error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection:', { reason, promise });
  if (reason instanceof Error) {
    Sentry.captureException(reason);
  }
});