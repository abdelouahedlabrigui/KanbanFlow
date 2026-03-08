import { initializePool, execute, closePool } from './pool';

const DDL_STATEMENTS = [
  // BOARDS
  `CREATE TABLE kanban_boards (
    id          VARCHAR2(36)   DEFAULT SYS_GUID() PRIMARY KEY,
    title       VARCHAR2(200)  NOT NULL,
    description CLOB,
    created_at  TIMESTAMP      DEFAULT SYSTIMESTAMP,
    updated_at  TIMESTAMP      DEFAULT SYSTIMESTAMP
  )`,

  // SWIMLANES
  `CREATE TABLE kanban_swimlanes (
    id          VARCHAR2(36)   DEFAULT SYS_GUID() PRIMARY KEY,
    board_id    VARCHAR2(36)   NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    title       VARCHAR2(200)  NOT NULL,
    position    NUMBER(5)      DEFAULT 0,
    color       VARCHAR2(20)   DEFAULT '#6B7280',
    created_at  TIMESTAMP      DEFAULT SYSTIMESTAMP
  )`,

  // COLUMNS
  `CREATE TABLE kanban_columns (
    id          VARCHAR2(36)   DEFAULT SYS_GUID() PRIMARY KEY,
    board_id    VARCHAR2(36)   NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    title       VARCHAR2(200)  NOT NULL,
    position    NUMBER(5)      DEFAULT 0,
    wip_limit   NUMBER(5),
    is_done_col NUMBER(1)      DEFAULT 0 CHECK (is_done_col IN (0,1)),
    is_doing_col NUMBER(1)     DEFAULT 0 CHECK (is_doing_col IN (0,1)),
    color       VARCHAR2(20)   DEFAULT '#374151',
    created_at  TIMESTAMP      DEFAULT SYSTIMESTAMP
  )`,

  // CARDS
  `CREATE TABLE kanban_cards (
    id              VARCHAR2(36)   DEFAULT SYS_GUID() PRIMARY KEY,
    board_id        VARCHAR2(36)   NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    column_id       VARCHAR2(36)   NOT NULL REFERENCES kanban_columns(id),
    swimlane_id     VARCHAR2(36)   REFERENCES kanban_swimlanes(id),
    title           VARCHAR2(500)  NOT NULL,
    description     CLOB,
    owner           VARCHAR2(200),
    priority        VARCHAR2(20)   DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    due_date        DATE,
    position        NUMBER(10)     DEFAULT 0,
    status          VARCHAR2(50)   DEFAULT 'TODO',
    tags            VARCHAR2(500),
    story_points    NUMBER(5),
    created_at      TIMESTAMP      DEFAULT SYSTIMESTAMP,
    updated_at      TIMESTAMP      DEFAULT SYSTIMESTAMP,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP
  )`,

  // CARD MOVEMENT LOG
  `CREATE TABLE kanban_card_moves (
    id              VARCHAR2(36)   DEFAULT SYS_GUID() PRIMARY KEY,
    card_id         VARCHAR2(36)   NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
    from_column_id  VARCHAR2(36)   REFERENCES kanban_columns(id),
    to_column_id    VARCHAR2(36)   REFERENCES kanban_columns(id),
    moved_by        VARCHAR2(200),
    reason          CLOB,
    is_recycle      NUMBER(1)      DEFAULT 0,
    moved_at        TIMESTAMP      DEFAULT SYSTIMESTAMP
  )`,

  // CARD CHECKLIST (DoD)
  `CREATE TABLE kanban_checklist_items (
    id          VARCHAR2(36)   DEFAULT SYS_GUID() PRIMARY KEY,
    card_id     VARCHAR2(36)   NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
    title       VARCHAR2(500)  NOT NULL,
    is_done     NUMBER(1)      DEFAULT 0 CHECK (is_done IN (0,1)),
    position    NUMBER(5)      DEFAULT 0,
    created_at  TIMESTAMP      DEFAULT SYSTIMESTAMP
  )`,

  // COMMENTS
  `CREATE TABLE kanban_comments (
    id          VARCHAR2(36)   DEFAULT SYS_GUID() PRIMARY KEY,
    card_id     VARCHAR2(36)   NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
    author      VARCHAR2(200),
    content     CLOB           NOT NULL,
    created_at  TIMESTAMP      DEFAULT SYSTIMESTAMP
  )`,

  // Indexes
  `CREATE INDEX idx_cards_column ON kanban_cards(column_id)`,
  `CREATE INDEX idx_cards_board  ON kanban_cards(board_id)`,
  `CREATE INDEX idx_moves_card   ON kanban_card_moves(card_id)`,
  `CREATE INDEX idx_cols_board   ON kanban_columns(board_id)`,
  `CREATE INDEX idx_swim_board   ON kanban_swimlanes(board_id)`,
];

async function dropIfExists(tableName: string) {
  try {
    await execute(`DROP TABLE ${tableName} CASCADE CONSTRAINTS`);
    console.log(`  Dropped ${tableName}`);
  } catch {
    // ignore – table doesn't exist
  }
}

export async function main() {
  await initializePool();

  console.log('🔧 Dropping existing tables...');
  const drops = [
    'kanban_comments',
    'kanban_checklist_items',
    'kanban_card_moves',
    'kanban_cards',
    'kanban_columns',
    'kanban_swimlanes',
    'kanban_boards',
  ];
  for (const t of drops) await dropIfExists(t);

  console.log('🔧 Creating schema...');
  for (const ddl of DDL_STATEMENTS) {
    try {
      await execute(ddl);
      const name = ddl.match(/CREATE (?:TABLE|INDEX) (\S+)/)?.[1] ?? '';
      console.log(`  ✓ ${name}`);
    } catch (err: unknown) {
      console.error('  ✗ Failed:', (err as Error).message.split('\n')[0]);
    }
  }

  // Seed sample data
  console.log('🌱 Seeding sample data...');
  await seedSampleData();

  await closePool();
  console.log('✅ Schema ready!');
}

async function seedSampleData() {
  // Board
  await execute(
    `INSERT INTO kanban_boards (id, title, description) VALUES ('BOARD-001', 'Marketing Q1', 'Q1 2025 Marketing Campaigns')`
  );

  // Swimlanes
  const lanes = [
    ['LANE-001', 'BOARD-001', 'Urgent', 0, '#EF4444'],
    ['LANE-002', 'BOARD-001', 'Routine', 1, '#6B7280'],
  ];
  for (const [id, bid, title, pos, color] of lanes) {
    await execute(
      `INSERT INTO kanban_swimlanes (id,board_id,title,position,color) VALUES (:1,:2,:3,:4,:5)`,
      [id, bid, title, pos, color]
    );
  }

  // Columns
  const cols = [
    ['COL-001', 'BOARD-001', 'Backlog',      0, null, 0, 0, '#374151'],
    ['COL-002', 'BOARD-001', 'In Progress',  1, 3,    0, 1, '#1D4ED8'],
    ['COL-003', 'BOARD-001', 'Review',       2, 2,    0, 0, '#7C3AED'],
    ['COL-004', 'BOARD-001', 'Done',         3, null, 1, 0, '#059669'],
  ];
  for (const [id, bid, title, pos, wip, isDone, isDoing, color] of cols) {
    await execute(
      `INSERT INTO kanban_columns (id,board_id,title,position,wip_limit,is_done_col,is_doing_col,color) VALUES (:1,:2,:3,:4,:5,:6,:7,:8)`,
      [id, bid, title, pos, wip, isDone, isDoing, color]
    );
  }

  // Sample cards
  const now = new Date();
  const cards = [
    ['CARD-001','BOARD-001','COL-001','LANE-001','Campaign Strategy Draft','Create Q1 campaign outline','Alice','HIGH',  0,'TODO'],
    ['CARD-002','BOARD-001','COL-001','LANE-002','SEO Keyword Research',   'Monthly SEO audit',          'Bob',  'MEDIUM',1,'TODO'],
    ['CARD-003','BOARD-001','COL-002','LANE-001','Social Media Calendar',  'Plan all social posts',      'Carol','CRITICAL',0,'DOING'],
    ['CARD-004','BOARD-001','COL-002','LANE-002','Email Newsletter',       'Write March newsletter',     'Dave', 'HIGH',  1,'DOING'],
    ['CARD-005','BOARD-001','COL-003','LANE-001','Ad Copy Review',         'Review paid search copy',    'Eve',  'MEDIUM',0,'REVIEW'],
    ['CARD-006','BOARD-001','COL-004','LANE-002','Brand Guidelines',       'Update brand doc',           'Frank','LOW',   0,'DONE'],
  ];

  for (const [id,bid,cid,lid,title,desc,owner,pri,pos,status] of cards) {
    const startedAt  = ['DOING','REVIEW','DONE'].includes(status as string) ? now : null;
    const completedAt = status === 'DONE' ? now : null;
    await execute(
      `INSERT INTO kanban_cards (id,board_id,column_id,swimlane_id,title,description,owner,priority,position,status,started_at,completed_at)
       VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12)`,
      [id,bid,cid,lid,title,desc,owner,pri,pos,status,startedAt,completedAt]
    );
  }

  // Checklist items for CARD-003
  await execute(
    `INSERT INTO kanban_checklist_items (id,card_id,title,is_done,position) VALUES ('CHK-001','CARD-003','Define target audience',1,0)`
  );
  await execute(
    `INSERT INTO kanban_checklist_items (id,card_id,title,is_done,position) VALUES ('CHK-002','CARD-003','Create content calendar',0,1)`
  );
  await execute(
    `INSERT INTO kanban_checklist_items (id,card_id,title,is_done,position) VALUES ('CHK-003','CARD-003','Schedule posts',0,2)`
  );

  console.log('  ✓ Sample data seeded');
}

main().catch(console.error);
