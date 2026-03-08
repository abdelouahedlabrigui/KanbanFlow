import { Router, Request, Response } from 'express';
import axios from 'axios';
import { execute } from '../db/pool';

const router = Router();

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen3:0.6b';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function getBoardContext(boardId: string): Promise<string> {
  try {
    const [boardRes, colRes, cardRes, metricsSnapshot] = await Promise.all([
      execute(`SELECT title, description FROM kanban_boards WHERE id = :1`, [boardId]),
      execute(
        `SELECT c.title, c.wip_limit,
          (SELECT COUNT(*) FROM kanban_cards k WHERE k.column_id = c.id) AS card_count
         FROM kanban_columns c WHERE c.board_id = :1 ORDER BY c.position`,
        [boardId]
      ),
      execute(
        `SELECT title, owner, priority, status, due_date, column_id FROM kanban_cards WHERE board_id = :1 ORDER BY priority DESC, position`,
        [boardId]
      ),
      execute<{ AVG_LEAD: number; AVG_CYCLE: number; DONE_WEEK: number }>(
        `SELECT 
          AVG((completed_at - created_at) * 24) AS avg_lead,
          AVG((completed_at - started_at) * 24) AS avg_cycle,
          SUM(CASE WHEN completed_at >= TRUNC(SYSTIMESTAMP,'IW') THEN 1 ELSE 0 END) AS done_week
         FROM kanban_cards WHERE board_id = :1 AND completed_at IS NOT NULL`,
        [boardId]
      ),
    ]);

    const board = boardRes.rows?.[0] as { TITLE: string; DESCRIPTION: string } | undefined;
    const cols = colRes.rows as { TITLE: string; WIP_LIMIT: number | null; CARD_COUNT: number }[];
    const cards = cardRes.rows as { TITLE: string; OWNER: string; PRIORITY: string; STATUS: string; DUE_DATE: Date | null }[];
    const metrics = metricsSnapshot.rows?.[0];

    const ctx = [
      `Board: ${board?.TITLE ?? 'Unknown'}`,
      `Description: ${board?.DESCRIPTION ?? 'N/A'}`,
      `\nColumns:`,
      ...cols.map((c) => `  - ${c.TITLE}: ${c.CARD_COUNT} cards${c.WIP_LIMIT ? ` (WIP limit: ${c.WIP_LIMIT})` : ''}`),
      `\nActive Cards (${cards.filter((c) => c.STATUS !== 'DONE').length} open):`,
      ...cards
        .filter((c) => c.STATUS !== 'DONE')
        .slice(0, 20)
        .map((c) => `  - [${c.PRIORITY}] "${c.TITLE}" owned by ${c.OWNER ?? 'unassigned'} (${c.STATUS})`),
      `\nMetrics:`,
      `  - Avg Lead Time: ${metrics?.AVG_LEAD ? Math.round(metrics.AVG_LEAD) + ' hours' : 'N/A'}`,
      `  - Avg Cycle Time: ${metrics?.AVG_CYCLE ? Math.round(metrics.AVG_CYCLE) + ' hours' : 'N/A'}`,
      `  - Completed This Week: ${metrics?.DONE_WEEK ?? 0}`,
      `\nBottlenecks:`,
      ...cols
        .filter((c) => c.WIP_LIMIT !== null && c.CARD_COUNT >= c.WIP_LIMIT)
        .map((c) => `  - ⚠️ "${c.TITLE}" is at/over WIP limit (${c.CARD_COUNT}/${c.WIP_LIMIT})`),
    ].join('\n');

    return ctx;
  } catch {
    return 'Board context unavailable.';
  }
}

// POST /api/ai/chat
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, boardId } = req.body as { messages: OllamaMessage[]; boardId?: string };

    let boardContext = '';
    if (boardId) {
      boardContext = await getBoardContext(boardId);
    }

    const systemPrompt = `You are KanbanAI, an expert Agile coach and productivity assistant embedded in a Kanban board management system.
Your role is to:
- Analyze board health and workflow efficiency
- Identify bottlenecks and suggest improvements
- Explain Kanban concepts and best practices
- Help prioritize work and manage WIP limits
- Review performance metrics and provide actionable insights
- Answer questions about tasks, assignments, and deadlines

${boardContext ? `\n== CURRENT BOARD CONTEXT ==\n${boardContext}\n== END CONTEXT ==\n` : ''}

Be concise, practical, and data-driven. Use the board context to give specific advice.`;

    const ollamaMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const response = await axios.post(
      `${OLLAMA_BASE}/api/chat`,
      {
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 512,
        },
      },
      { timeout: 60000 }
    );

    const aiMessage = response.data?.message?.content ?? 'No response from AI';
    res.json({ message: aiMessage, model: OLLAMA_MODEL });
  } catch (err) {
    const axiosErr = err as { response?: { data: unknown }; code?: string };
    if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: 'Ollama not running',
        message: 'Start Ollama with: ollama serve && ollama pull qwen3:0.6b',
      });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/ai/suggest/:boardId  - Auto suggestions
router.get('/suggest/:boardId', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    const context = await getBoardContext(boardId);

    const response = await axios.post(
      `${OLLAMA_BASE}/api/chat`,
      {
        model: OLLAMA_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a Kanban coach. Give 3 specific, actionable suggestions in bullet points. Be brief.',
          },
          {
            role: 'user',
            content: `Analyze this board and give me 3 specific improvement suggestions:\n\n${context}`,
          },
        ],
        stream: false,
        options: { temperature: 0.6, num_predict: 256 },
      },
      { timeout: 30000 }
    );

    res.json({
      suggestions: response.data?.message?.content ?? 'Unable to generate suggestions',
    });
  } catch (err) {
    res.status(503).json({ error: 'AI service unavailable', message: (err as Error).message });
  }
});

export default router;
