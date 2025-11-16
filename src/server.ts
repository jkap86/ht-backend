import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import router from "./app/routes";
import { errorHandler } from "./app/middleware/error.middleware";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", router);

// Global error handler (must be last middleware before listen)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
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
