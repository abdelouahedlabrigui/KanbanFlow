import { Router, Request, Response } from 'express';
import { execute } from '../db/pool';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { boardId, title, wipLimit, isDoneCol, isDoingCol, color, position } = req.body;
    if (!boardId || !title) return res.status(400).json({ error: 'boardId and title required' });

    let pos = position;
    if (pos === undefined) {
      const posRes = await execute<{ MAX_POS: number }>(
        `SELECT NVL(MAX(position), -1) AS max_pos FROM kanban_columns WHERE board_id = :1`, [boardId]
      );
      pos = (posRes.rows?.[0]?.MAX_POS ?? -1) + 1;
    }

    const id = uuidv4();
    await execute(
      `INSERT INTO kanban_columns (id,board_id,title,position,wip_limit,is_done_col,is_doing_col,color)
       VALUES (:1,:2,:3,:4,:5,:6,:7,:8)`,
      [id, boardId, title, pos, wipLimit ?? null, isDoneCol ? 1 : 0, isDoingCol ? 1 : 0, color ?? '#374151']
    );
    res.status(201).json({ id, title });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, wipLimit, isDoneCol, isDoingCol, color, position } = req.body;
    await execute(
      `UPDATE kanban_columns SET
        title = NVL(:1, title),
        wip_limit = :2,
        is_done_col = NVL(:3, is_done_col),
        is_doing_col = NVL(:4, is_doing_col),
        color = NVL(:5, color),
        position = NVL(:6, position)
       WHERE id = :7`,
      [title ?? null, wipLimit !== undefined ? wipLimit : null, isDoneCol !== undefined ? (isDoneCol ? 1 : 0) : null,
       isDoingCol !== undefined ? (isDoingCol ? 1 : 0) : null, color ?? null, position ?? null, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const count = await execute<{ CNT: number }>(
      `SELECT COUNT(*) AS cnt FROM kanban_cards WHERE column_id = :1`, [req.params.id]
    );
    if ((count.rows?.[0]?.CNT ?? 0) > 0) {
      return res.status(409).json({ error: 'Cannot delete column with cards. Move cards first.' });
    }
    await execute(`DELETE FROM kanban_columns WHERE id = :1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
