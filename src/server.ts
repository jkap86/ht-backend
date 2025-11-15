import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import router from "./app/routes";
import { errorHandler } from "./app/middleware/errorHandler";

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

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
