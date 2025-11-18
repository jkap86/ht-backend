import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";

import { pool } from "./db/pool";
import { Container } from "./infrastructure/di/Container";
import { errorHandler } from "./app/middleware/error.middleware";
import { initializeSocketService } from "./app/services/socket.service";

dotenv.config();

// Initialize DI Container before loading routes
Container.initialize(pool);

const app = express();

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // In development, allow any localhost port
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }

    // In production, use the configured URL
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }

    // Fallback for common development ports
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:64629',
      'http://localhost:8080',
      'http://localhost:4200'
    ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Reject other origins
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes - import dynamically after container initialization
const router = require("./app/routes").default;
app.use("/api", router);

// Global error handler (must be last middleware before listen)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Create HTTP server and initialize Socket.IO
const server = createServer(app);
initializeSocketService(server);

server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`WebSocket server initialized`);
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

