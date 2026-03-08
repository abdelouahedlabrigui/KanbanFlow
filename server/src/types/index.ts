export interface Board {
  ID: string;
  TITLE: string;
  DESCRIPTION?: string;
  CREATED_AT: Date;
  UPDATED_AT: Date;
}

export interface Column {
  ID: string;
  BOARD_ID: string;
  TITLE: string;
  POSITION: number;
  WIP_LIMIT?: number;
  IS_DONE_COL: number;
  IS_DOING_COL: number;
  COLOR: string;
  CREATED_AT: Date;
  CARD_COUNT?: number;
}

export interface Swimlane {
  ID: string;
  BOARD_ID: string;
  TITLE: string;
  POSITION: number;
  COLOR: string;
  CREATED_AT: Date;
}

export interface Card {
  ID: string;
  BOARD_ID: string;
  COLUMN_ID: string;
  SWIMLANE_ID?: string;
  TITLE: string;
  DESCRIPTION?: string;
  OWNER?: string;
  PRIORITY: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  DUE_DATE?: Date;
  POSITION: number;
  STATUS: string;
  TAGS?: string;
  STORY_POINTS?: number;
  CREATED_AT: Date;
  UPDATED_AT: Date;
  STARTED_AT?: Date;
  COMPLETED_AT?: Date;
}

export interface ChecklistItem {
  ID: string;
  CARD_ID: string;
  TITLE: string;
  IS_DONE: number;
  POSITION: number;
  CREATED_AT: Date;
}

export interface CardMove {
  ID: string;
  CARD_ID: string;
  FROM_COLUMN_ID?: string;
  TO_COLUMN_ID?: string;
  MOVED_BY?: string;
  REASON?: string;
  IS_RECYCLE: number;
  MOVED_AT: Date;
}

export interface Comment {
  ID: string;
  CARD_ID: string;
  AUTHOR?: string;
  CONTENT: string;
  CREATED_AT: Date;
}

export interface Metrics {
  averageLeadTime: number;
  averageCycleTime: number;
  throughputPerWeek: number;
  bottleneckColumns: string[];
  completedThisWeek: number;
  wipUtilization: { columnId: string; title: string; count: number; limit: number | null }[];
}
