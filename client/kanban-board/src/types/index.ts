export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Status = 'TODO' | 'DOING' | 'REVIEW' | 'DONE';

export interface Board {
  ID: string;
  TITLE: string;
  DESCRIPTION?: string;
  CREATED_AT: string;
  UPDATED_AT: string;
  card_count?: number;
  columns?: Column[];
  swimlanes?: Swimlane[];
  cards?: Card[];
}

export interface Column {
  ID: string;
  BOARD_ID: string;
  TITLE: string;
  POSITION: number;
  WIP_LIMIT?: number | null;
  IS_DONE_COL: number;
  IS_DOING_COL: number;
  COLOR: string;
  CREATED_AT: string;
  CARD_COUNT?: number;
}

export interface Swimlane {
  ID: string;
  BOARD_ID: string;
  TITLE: string;
  POSITION: number;
  COLOR: string;
  CREATED_AT: string;
}

export interface CheckListItem {
    ID: string;
    CARD_ID: string;
    TITLE: string;
    IS_DONE: number;
    POSITION: number;
    CREATED_AT: string;
}

export interface Card {
  ID: string;
  BOARD_ID: string;
  COLUMN_ID: string;
  SWIMLANE_ID?: string | null;
  TITLE: string;
  DESCRIPTION?: string;
  OWNER?: string;
  PRIORITY: Priority;
  DUE_DATE?: string | null;
  POSITION: number;
  STATUS: Status;
  TAGS?: string;
  STORY_POINTS?: number | null;
  CREATED_AT: string;
  UPDATED_AT: string;
  STARTED_AT?: string | null;
  COMPLETED_AT?: string | null;
  checklist?: { total: number; done: number };
}

export interface CardDetail extends Omit<Card, 'checklist'> {
    checklist: CheckListItem[]; // Now this is the full array
    checklistSummary?: { total: number; done: number }; // Moved summary here
    comments: Comment[];
    moves: CardMove[];
}

export interface Comment {
  ID: string;
  CARD_ID: string;
  AUTHOR?: string;
  CONTENT: string;
  CREATED_AT: string;
}

export interface CardMove {
  ID: string;
  CARD_ID: string;
  FROM_COLUMN_ID?: string;
  TO_COLUMN_ID?: string;
  FROM_COL_TITLE?: string;
  TO_COL_TITLE?: string;
  MOVED_BY?: string;
  REASON?: string;
  IS_RECYCLE: number;
  MOVED_AT: string;
}

export interface Analytics {
  leadTime: { average: number; min: number; max: number };
  cycleTime: { average: number };
  throughput: {
    weekly: { WEEK_START: string; COMPLETED: number }[];
    averagePerWeek: number;
    completedThisWeek: number;
  };
  wipUtilization: {
    columnId: string;
    title: string;
    count: number;
    limit: number | null;
    color: string;
    isBottleneck: boolean;
  }[];
  bottleneckColumns: string[];
  priorityDistribution: { PRIORITY: string; CNT: number }[];
  ownerWorkload: { OWNER: string; TOTAL: number; DONE: number; IN_PROGRESS: number }[];
  recycleRate: { totalMoves: number; recycles: number; rate: number };
  overdueCount: number;
  agingCards: { COL_TITLE: string; CARD_TITLE: string; DAYS_OLD: number; PRIORITY: string; OWNER: string }[];
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}
