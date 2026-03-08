import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializePool, closePool } from './db/pool';
import boardsRouter from './routes/boards';
import cardsRouter from './routes/cards';
import columnsRouter from './routes/columns';
import swimlanesRouter from './routes/swimlanes';
import analyticsRouter from './routes/analytics';
import aiRouter from './routes/ai';

dotenv.config();


const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), model: process.env.OLLAMA_MODEL });
});

// Routes
app.use('/api/boards', boardsRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/columns', columnsRouter);
app.use('/api/swimlanes', swimlanesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ai', aiRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

async function start() {
  try {
    await initializePool();
    app.listen(PORT, () => {
      console.log(`🚀 Kanban server running on http://localhost:${PORT}`);
      console.log(`🤖 AI: ${process.env.OLLAMA_MODEL} via ${process.env.OLLAMA_BASE_URL}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

start();
