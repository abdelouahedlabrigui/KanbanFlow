import { Router, Request, Response } from 'express';
import { execute } from '../db/pool';
import { Board } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET all boards
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await execute<Board>(
      `SELECT b.*, 
        (SELECT COUNT(*) FROM kanban_cards c WHERE c.board_id = b.id) AS card_count
       FROM kanban_boards b ORDER BY b.created_at DESC`
    );
    res.json(result.rows ?? []);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET single board with columns, swimlanes, cards
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [boardRes, colRes, laneRes, cardRes] = await Promise.all([
      execute<Board>(`SELECT * FROM kanban_boards WHERE id = :1`, [id]),
      execute(`SELECT c.*, 
        (SELECT COUNT(*) FROM kanban_cards k WHERE k.column_id = c.id) AS card_count
       FROM kanban_columns c WHERE c.board_id = :1 ORDER BY c.position`, [id]),
      execute(`SELECT * FROM kanban_swimlanes WHERE board_id = :1 ORDER BY position`, [id]),
      execute(`SELECT * FROM kanban_cards WHERE board_id = :1 ORDER BY column_id, position`, [id]),
    ]);

    if (!boardRes.rows?.length) return res.status(404).json({ error: 'Board not found' });

    const board = boardRes.rows[0] ?? [];
    const columns = colRes.rows ?? [];
    const swimlanes = laneRes.rows ?? [];
    const cards = cardRes.rows ?? [];

    console.log("boardRes keys:", Object.keys(boardRes));
    console.log("boardRes.rows[0] keys:", boardRes.rows?.[0] ? Object.keys(boardRes.rows[0]) : "no rows");

    // Attach checklist counts
    const cardIds = (cards as { ID: string }[]).map((c) => c.ID);
    let checklists: Record<string, { total: number; done: number }> = {};
    if (cardIds.length) {
      const clResult = await execute(
        `SELECT card_id, COUNT(*) AS total, SUM(is_done) AS done 
         FROM kanban_checklist_items 
         WHERE card_id IN (${cardIds.map((_, i) => `:${i + 1}`).join(',')})
         GROUP BY card_id`,
        cardIds
      );
      for (const row of (clResult.rows ?? []) as { CARD_ID: string; TOTAL: number; DONE: number }[]) {
        checklists[row.CARD_ID] = { total: row.TOTAL, done: row.DONE };
      }
    }

    const enrichedCards = (cards as { ID: string }[]).map((c) => ({
      ...c,
      checklist: checklists[c.ID] ?? { total: 0, done: 0 },
    }));
    
    console.log("About to send response. Keys:", Object.keys({
      ...board,
      columns,
      swimlanes,
      cards: enrichedCards
    }));

    // Optional: check one level deeper
    console.log("board keys:", Object.keys(board));
    console.log("First card keys:", cards[0] ? Object.keys(cards[0]) : "no cards");

    // or — more compatible (but loses Date objects → strings)
    const safePayload = JSON.parse(JSON.stringify({
      ...board,
      columns,
      swimlanes,
      cards: enrichedCards,
    }));

    res.json(safePayload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST create board
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const id = uuidv4();
    await execute(
      `INSERT INTO kanban_boards (id, title, description) VALUES (:1, :2, :3)`,
      [id, title, description ?? null]
    );

    // Create default columns
    const defaultCols = [
      { title: 'Backlog',     pos: 0, wip: null, isDone: 0, isDoing: 0, color: '#374151' },
      { title: 'In Progress', pos: 1, wip: 3,    isDone: 0, isDoing: 1, color: '#1D4ED8' },
      { title: 'Review',      pos: 2, wip: 2,    isDone: 0, isDoing: 0, color: '#7C3AED' },
      { title: 'Done',        pos: 3, wip: null, isDone: 1, isDoing: 0, color: '#059669' },
    ];
    for (const col of defaultCols) {
      await execute(
        `INSERT INTO kanban_columns (id,board_id,title,position,wip_limit,is_done_col,is_doing_col,color) VALUES (:1,:2,:3,:4,:5,:6,:7,:8)`,
        [uuidv4(), id, col.title, col.pos, col.wip, col.isDone, col.isDoing, col.color]
      );
    }

    // Default swimlanes
    await execute(
      `INSERT INTO kanban_swimlanes (id,board_id,title,position,color) VALUES (:1,:2,'Urgent',0,'#EF4444')`,
      [uuidv4(), id]
    );
    await execute(
      `INSERT INTO kanban_swimlanes (id,board_id,title,position,color) VALUES (:1,:2,'Routine',1,'#6B7280')`,
      [uuidv4(), id]
    );

    res.status(201).json({ id, title });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT update board
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    await execute(
      `UPDATE kanban_boards SET title=:1, description=:2, updated_at=SYSTIMESTAMP WHERE id=:3`,
      [title, description ?? null, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE board
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await execute(`DELETE FROM kanban_boards WHERE id=:1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
