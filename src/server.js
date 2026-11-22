import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets from /public
const publicPath = path.resolve(__dirname, '../public');
app.use(express.static(publicPath));

// Deployment health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'Endpoint Health Monitor Demo server is operational',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start listening only when executed directly
let server;
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  server = app.listen(PORT, () => {
    console.log(`Endpoint Health Monitor Demo running at http://localhost:${PORT}`);
  });
}

export { app, server };
