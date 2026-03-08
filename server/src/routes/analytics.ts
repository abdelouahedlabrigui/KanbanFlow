import { Router, Request, Response } from 'express';
import { execute } from '../db/pool';

const router = Router();

router.get('/board/:boardId', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;

    // Lead time: creation to completion (hours)
    const leadTimeRes = await execute<{ AVG_LEAD: number; MIN_LEAD: number; MAX_LEAD: number }>(
      `SELECT 
        AVG((completed_at - created_at) * 24) AS avg_lead,
        MIN((completed_at - created_at) * 24) AS min_lead,
        MAX((completed_at - created_at) * 24) AS max_lead
       FROM kanban_cards
       WHERE board_id = :1 AND completed_at IS NOT NULL`,
      [boardId]
    );

    // Cycle time: started to completion (hours)
    const cycleTimeRes = await execute<{ AVG_CYCLE: number }>(
      `SELECT AVG((completed_at - started_at) * 24) AS avg_cycle
       FROM kanban_cards
       WHERE board_id = :1 AND completed_at IS NOT NULL AND started_at IS NOT NULL`,
      [boardId]
    );

    // Throughput per week for last 8 weeks
    const throughputRes = await execute<{ WEEK_START: string; COMPLETED: number }>(
      `SELECT 
        TO_CHAR(TRUNC(completed_at, 'IW'), 'YYYY-MM-DD') AS week_start,
        COUNT(*) AS completed
       FROM kanban_cards
       WHERE board_id = :1 AND completed_at IS NOT NULL
         AND completed_at > SYSTIMESTAMP - INTERVAL '56' DAY
       GROUP BY TRUNC(completed_at, 'IW')
       ORDER BY TRUNC(completed_at, 'IW')`,
      [boardId]
    );

    // Completed this week
    const thisWeekRes = await execute<{ CNT: number }>(
      `SELECT COUNT(*) AS cnt FROM kanban_cards
       WHERE board_id = :1 AND completed_at >= TRUNC(SYSTIMESTAMP, 'IW')`,
      [boardId]
    );

    // WIP utilization per column
    const wipRes = await execute<{ COL_ID: string; TITLE: string; CNT: number; WIP_LIMIT: number | null; COLOR: string }>(
      `SELECT c.id AS col_id, c.title, c.wip_limit,
        (SELECT COUNT(*) FROM kanban_cards k WHERE k.column_id = c.id) AS cnt,
        c.color
       FROM kanban_columns c WHERE c.board_id = :1 ORDER BY c.position`,
      [boardId]
    );

    // Priority distribution
    const priorityRes = await execute<{ PRIORITY: string; CNT: number }>(
      `SELECT priority, COUNT(*) AS cnt FROM kanban_cards
       WHERE board_id = :1 AND status != 'DONE'
       GROUP BY priority ORDER BY 
        CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END`,
      [boardId]
    );

    // Cards by owner (workload)
    const ownerRes = await execute<{ OWNER: string; TOTAL: number; DONE: number; IN_PROGRESS: number }>(
      `SELECT 
        NVL(owner, 'Unassigned') AS owner,
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) AS done,
        SUM(CASE WHEN status = 'DOING' THEN 1 ELSE 0 END) AS in_progress
       FROM kanban_cards
       WHERE board_id = :1
       GROUP BY NVL(owner, 'Unassigned')
       ORDER BY total DESC`,
      [boardId]
    );

    // Recycle rate
    const recycleRes = await execute<{ TOTAL_MOVES: number; RECYCLES: number }>(
      `SELECT COUNT(*) AS total_moves, SUM(m.is_recycle) AS recycles
       FROM kanban_card_moves m
       JOIN kanban_cards c ON m.card_id = c.id
       WHERE c.board_id = :1`,
      [boardId]
    );

    // Overdue cards
    const overdueRes = await execute<{ CNT: number }>(
      `SELECT COUNT(*) AS cnt FROM kanban_cards
       WHERE board_id = :1 AND due_date < SYSDATE AND status != 'DONE'`,
      [boardId]
    );

    // Aging: cards in non-done columns by age buckets
    const agingRes = await execute<{ COL_TITLE: string; CARD_TITLE: string; DAYS_OLD: number; PRIORITY: string; OWNER: string }>(
      `SELECT c.title AS col_title, k.title AS card_title, 
        ROUND(SYSDATE - CAST(k.created_at AS DATE)) AS days_old,
        k.priority, NVL(k.owner, 'Unassigned') AS owner
       FROM kanban_cards k JOIN kanban_columns c ON k.column_id = c.id
       WHERE k.board_id = :1 AND k.status != 'DONE'
       ORDER BY days_old DESC FETCH FIRST 10 ROWS ONLY`,
      [boardId]
    );

    const wipRows = wipRes.rows ?? [];
    const bottleneckColumns = wipRows
      .filter((r) => r.WIP_LIMIT !== null && r.CNT >= r.WIP_LIMIT)
      .map((r) => r.COL_ID);

    const avgThroughput =
      (throughputRes.rows ?? []).reduce((sum, r) => sum + r.COMPLETED, 0) /
      Math.max((throughputRes.rows ?? []).length, 1);

    res.json({
      leadTime: {
        average: leadTimeRes.rows?.[0]?.AVG_LEAD ?? 0,
        min: leadTimeRes.rows?.[0]?.MIN_LEAD ?? 0,
        max: leadTimeRes.rows?.[0]?.MAX_LEAD ?? 0,
      },
      cycleTime: {
        average: cycleTimeRes.rows?.[0]?.AVG_CYCLE ?? 0,
      },
      throughput: {
        weekly: throughputRes.rows ?? [],
        averagePerWeek: Math.round(avgThroughput * 10) / 10,
        completedThisWeek: thisWeekRes.rows?.[0]?.CNT ?? 0,
      },
      wipUtilization: wipRows.map((r) => ({
        columnId: r.COL_ID,
        title: r.TITLE,
        count: r.CNT,
        limit: r.WIP_LIMIT,
        color: r.COLOR,
        isBottleneck: r.WIP_LIMIT !== null && r.CNT >= r.WIP_LIMIT,
      })),
      bottleneckColumns,
      priorityDistribution: priorityRes.rows ?? [],
      ownerWorkload: ownerRes.rows ?? [],
      recycleRate: {
        totalMoves: recycleRes.rows?.[0]?.TOTAL_MOVES ?? 0,
        recycles: recycleRes.rows?.[0]?.RECYCLES ?? 0,
        rate: recycleRes.rows?.[0]?.TOTAL_MOVES
          ? Math.round(((recycleRes.rows[0].RECYCLES ?? 0) / recycleRes.rows[0].TOTAL_MOVES) * 100)
          : 0,
      },
      overdueCount: overdueRes.rows?.[0]?.CNT ?? 0,
      agingCards: agingRes.rows ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
