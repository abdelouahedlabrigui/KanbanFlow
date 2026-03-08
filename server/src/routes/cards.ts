import { Router, Request, Response } from 'express';
import { execute } from '../db/pool';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET cards for a board (optionally filter by column)
router.get('/board/:boardId', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    const { columnId } = req.query;

    let sql = `SELECT * FROM kanban_cards WHERE board_id = :1`;
    const binds: unknown[] = [boardId];

    if (columnId) {
      sql += ` AND column_id = :2`;
      binds.push(columnId);
    }
    sql += ` ORDER BY position`;

    const result = await execute(sql, binds);
    res.json(result.rows ?? []);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET single card with checklist and comments
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [cardRes, clRes, cmtRes, moveRes] = await Promise.all([
      execute(`SELECT * FROM kanban_cards WHERE id = :1`, [id]),
      execute(`SELECT * FROM kanban_checklist_items WHERE card_id = :1 ORDER BY position`, [id]),
      execute(`SELECT * FROM kanban_comments WHERE card_id = :1 ORDER BY created_at DESC`, [id]),
      execute(
        `SELECT m.*, fc.title AS from_col_title, tc.title AS to_col_title
         FROM kanban_card_moves m
         LEFT JOIN kanban_columns fc ON m.from_column_id = fc.id
         LEFT JOIN kanban_columns tc ON m.to_column_id = tc.id
         WHERE m.card_id = :1 ORDER BY m.moved_at DESC`,
        [id]
      ),
    ]);

    if (!cardRes.rows?.length) return res.status(404).json({ error: 'Card not found' });

    res.json({
      ...cardRes.rows[0],
      checklist: clRes.rows ?? [],
      comments: cmtRes.rows ?? [],
      moves: moveRes.rows ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST create card
router.post('/', async (req: Request, res: Response) => {
  try {
    const { boardId, columnId, swimlaneId, title, description, owner, priority, dueDate, tags, storyPoints } = req.body;
    if (!boardId || !columnId || !title) return res.status(400).json({ error: 'boardId, columnId, title required' });

    // Get max position in column
    const posResult = await execute<{ MAX_POS: number }>(
      `SELECT NVL(MAX(position), -1) AS max_pos FROM kanban_cards WHERE column_id = :1`,
      [columnId]
    );
    const position = (posResult.rows?.[0]?.MAX_POS ?? -1) + 1;

    // Get column status
    const colResult = await execute<{ STATUS: string; IS_DOING_COL: number; IS_DONE_COL: number }>(
      `SELECT 
        CASE WHEN is_done_col=1 THEN 'DONE' WHEN is_doing_col=1 THEN 'DOING' ELSE 'TODO' END AS status,
        is_doing_col, is_done_col
       FROM kanban_columns WHERE id = :1`,
      [columnId]
    );
    const status = colResult.rows?.[0]?.STATUS ?? 'TODO';

    const id = uuidv4();
    const parsedDue = dueDate ? new Date(dueDate) : null;

    await execute(
      `INSERT INTO kanban_cards (id,board_id,column_id,swimlane_id,title,description,owner,priority,due_date,position,status,tags,story_points)
       VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13)`,
      [id, boardId, columnId, swimlaneId ?? null, title, description ?? null, owner ?? null,
       priority ?? 'MEDIUM', parsedDue, position, status, tags ?? null, storyPoints ?? null]
    );

    const newCard = await execute(`SELECT * FROM kanban_cards WHERE id = :1`, [id]);
    res.status(201).json(newCard.rows?.[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH move card to column
router.patch('/:id/move', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { toColumnId, position, movedBy, reason } = req.body;
    if (!toColumnId) return res.status(400).json({ error: 'toColumnId required' });

    // Get current card
    const cardResult = await execute<{ COLUMN_ID: string; STATUS: string }>(
      `SELECT column_id, status FROM kanban_cards WHERE id = :1`, [id]
    );
    if (!cardResult.rows?.length) return res.status(404).json({ error: 'Card not found' });

    const fromColumnId = cardResult.rows[0].COLUMN_ID;

    // Get target column info
    const toColResult = await execute<{ WIP_LIMIT: number | null; IS_DONE_COL: number; IS_DOING_COL: number; POSITION: number; TITLE: string }>(
      `SELECT wip_limit, is_done_col, is_doing_col, position, title FROM kanban_columns WHERE id = :1`, [toColumnId]
    );
    if (!toColResult.rows?.length) return res.status(404).json({ error: 'Column not found' });

    const toCol = toColResult.rows[0];

    // Get source column position for recycle detection
    const fromColResult = await execute<{ POSITION: number }>(
      `SELECT position FROM kanban_columns WHERE id = :1`, [fromColumnId]
    );
    const fromColPos = fromColResult.rows?.[0]?.POSITION ?? 0;
    const isRecycle = toCol.POSITION < fromColPos ? 1 : 0;

    // WIP check
    const wipCount = await execute<{ CNT: number }>(
      `SELECT COUNT(*) AS cnt FROM kanban_cards WHERE column_id = :1`, [toColumnId]
    );
    const count = wipCount.rows?.[0]?.CNT ?? 0;
    if (toCol.WIP_LIMIT !== null && count >= toCol.WIP_LIMIT) {
      return res.status(409).json({
        error: 'WIP_LIMIT_EXCEEDED',
        message: `Column "${toCol.TITLE}" is at WIP limit (${toCol.WIP_LIMIT}). Pull work only when capacity exists.`,
        wipLimit: toCol.WIP_LIMIT,
        currentCount: count,
      });
    }

    // DoD check: if moving to done column, all checklist items must be complete
    if (toCol.IS_DONE_COL === 1) {
      const dodResult = await execute<{ TOTAL: number; DONE: number }>(
        `SELECT COUNT(*) AS total, SUM(is_done) AS done FROM kanban_checklist_items WHERE card_id = :1`, [id]
      );
      const dod = dodResult.rows?.[0];
      if (dod && dod.TOTAL > 0 && dod.DONE < dod.TOTAL) {
        return res.status(409).json({
          error: 'DOD_NOT_MET',
          message: `Definition of Done not met: ${dod.DONE}/${dod.TOTAL} checklist items complete.`,
          dodTotal: dod.TOTAL,
          dodDone: dod.DONE,
        });
      }
    }

    // Determine new status
    let newStatus = 'TODO';
    if (toCol.IS_DONE_COL === 1) newStatus = 'DONE';
    else if (toCol.IS_DOING_COL === 1) newStatus = 'DOING';

    const newPosition = position ?? count;

    // Update card
    await execute(
      `UPDATE kanban_cards SET 
        column_id = :1, position = :2, status = :3,
        started_at = CASE WHEN :4 = 'DOING' AND started_at IS NULL THEN SYSTIMESTAMP ELSE started_at END,
        completed_at = CASE WHEN :5 = 'DONE' THEN SYSTIMESTAMP ELSE NULL END,
        updated_at = SYSTIMESTAMP
       WHERE id = :6`,
      [toColumnId, newPosition, newStatus, newStatus, newStatus, id]
    );

    // Log the move
    await execute(
      `INSERT INTO kanban_card_moves (id,card_id,from_column_id,to_column_id,moved_by,reason,is_recycle)
       VALUES (:1,:2,:3,:4,:5,:6,:7)`,
      [uuidv4(), id, fromColumnId, toColumnId, movedBy ?? null, reason ?? null, isRecycle]
    );

    res.json({ success: true, newStatus, isRecycle });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH update card
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, owner, priority, dueDate, tags, storyPoints, position } = req.body;

    await execute(
      `UPDATE kanban_cards SET
        title = NVL(:1, title),
        description = NVL(:2, description),
        owner = NVL(:3, owner),
        priority = NVL(:4, priority),
        due_date = NVL(:5, due_date),
        tags = NVL(:6, tags),
        story_points = NVL(:7, story_points),
        position = NVL(:8, position),
        updated_at = SYSTIMESTAMP
       WHERE id = :9`,
      [title ?? null, description ?? null, owner ?? null, priority ?? null,
       dueDate ? new Date(dueDate) : null, tags ?? null, storyPoints ?? null, position ?? null, id]
    );

    const updated = await execute(`SELECT * FROM kanban_cards WHERE id = :1`, [id]);
    res.json(updated.rows?.[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE card
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await execute(`DELETE FROM kanban_cards WHERE id = :1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST add checklist item
router.post('/:id/checklist', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const posRes = await execute<{ MAX_POS: number }>(
      `SELECT NVL(MAX(position), -1) AS max_pos FROM kanban_checklist_items WHERE card_id = :1`, [id]
    );
    const position = (posRes.rows?.[0]?.MAX_POS ?? -1) + 1;
    const itemId = uuidv4();
    await execute(
      `INSERT INTO kanban_checklist_items (id,card_id,title,position) VALUES (:1,:2,:3,:4)`,
      [itemId, id, title, position]
    );
    res.status(201).json({ id: itemId, title, is_done: 0, position });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH toggle checklist item
router.patch('/:id/checklist/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    await execute(
      `UPDATE kanban_checklist_items SET is_done = CASE WHEN is_done=1 THEN 0 ELSE 1 END WHERE id = :1`,
      [itemId]
    );
    const result = await execute(`SELECT * FROM kanban_checklist_items WHERE id = :1`, [itemId]);
    res.json(result.rows?.[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE checklist item
router.delete('/:id/checklist/:itemId', async (req: Request, res: Response) => {
  try {
    await execute(`DELETE FROM kanban_checklist_items WHERE id = :1`, [req.params.itemId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST add comment
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { author, content } = req.body;
    const commentId = uuidv4();
    await execute(
      `INSERT INTO kanban_comments (id,card_id,author,content) VALUES (:1,:2,:3,:4)`,
      [commentId, id, author ?? 'Anonymous', content]
    );
    res.status(201).json({ id: commentId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
