import { Router, Request, Response } from 'express';
import { execute } from '../db/pool';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { boardId, title, color } = req.body;
    if (!boardId || !title) return res.status(400).json({ error: 'boardId and title required' });

    const posRes = await execute<{ MAX_POS: number }>(
      `SELECT NVL(MAX(position), -1) AS max_pos FROM kanban_swimlanes WHERE board_id = :1`, [boardId]
    );
    const position = (posRes.rows?.[0]?.MAX_POS ?? -1) + 1;
    const id = uuidv4();

    await execute(
      `INSERT INTO kanban_swimlanes (id,board_id,title,position,color) VALUES (:1,:2,:3,:4,:5)`,
      [id, boardId, title, position, color ?? '#6B7280']
    );
    res.status(201).json({ id, title, position, color });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { title, color } = req.body;
    await execute(
      `UPDATE kanban_swimlanes SET title=NVL(:1,title), color=NVL(:2,color) WHERE id=:3`,
      [title ?? null, color ?? null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await execute(`UPDATE kanban_cards SET swimlane_id=NULL WHERE swimlane_id=:1`, [req.params.id]);
    await execute(`DELETE FROM kanban_swimlanes WHERE id=:1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
