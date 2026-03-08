# KanbanFlow 🚀

A full-stack Agile Kanban board with Oracle SQL backend, React/TypeScript frontend, and **Ollama qwen3:0.6b** AI coaching.

## Architecture

```
kanban/
├── server/          # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── db/      # Oracle pool + schema init
│   │   ├── routes/  # boards, cards, columns, swimlanes, analytics, AI
│   │   └── types/   # TypeScript interfaces
├── client/          # React 18 + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── Board/    # Board list, Board page, Kanban view
│   │   │   ├── Card/     # Card component, detail modal, create modal
│   │   │   ├── Column/   # Column component with DnD
│   │   │   ├── AI/       # AI chat panel
│   │   │   └── Analytics/# Charts, metrics, aging analysis
│   │   ├── store/   # Zustand state management
│   │   ├── styles/  # Global CSS (industrial dark theme)
│   │   └── utils/   # Axios API client
└── docker-compose.yml
```

## Features

### Data Model
- **Board → Column → Swimlane → Card** hierarchy
- Full CRUD for all entities
- Nested swimlane × column intersection layout

### Kanban Rules
| Feature | Implementation |
|---------|---------------|
| **WIP Enforcement** | Server returns `409 WIP_LIMIT_EXCEEDED` when column at capacity |
| **Definition of Done** | Checklist items must all be complete to move to "Done" column |
| **Recycle Detection** | Moving cards backwards logs `IS_RECYCLE=1` with reason |
| **Pull System** | WIP warnings prevent pushing work into busy columns |
| **Bottleneck Highlight** | Red column header + board-level warning when WIP limit hit |
| **Priority Sorting** | Drag-and-drop card reordering within columns |
| **Linear Flow** | Left-to-right progress with backward move reason logging |

### Analytics
- **Lead Time**: Creation → Completion (hours/days)
- **Cycle Time**: Started → Completion (doing stages only)
- **Throughput**: Cards completed per week (last 8 weeks chart)
- **WIP Utilization**: Bar chart per column with limit indicators
- **Priority Distribution**: Pie chart of open cards
- **Team Workload**: Stacked bar by owner (in progress vs done)
- **Aging Cards**: Oldest open items table
- **Recycle Rate**: % of backwards moves
- **Overdue Count**: Past due date cards

### AI Coach (Ollama qwen3:0.6b)
- Context-aware: sends live board data (columns, cards, metrics) to the model
- Chat interface with conversation history
- Quick-start prompts for common questions
- Auto-suggest: one-click board health analysis

---

## Prerequisites

- **Node.js** 18+
- **Oracle Database** (XE 21c free, or any 19c+)
- **Oracle Instant Client** installed and in PATH
- **Ollama** running locally with `qwen3:0.6b` pulled

---

## Setup

### 1. Oracle Database

**Using Docker (recommended):**
```bash
docker compose up oracle -d
# Wait ~2 min for startup, then create the app user:
docker exec -it kanban-oracle sqlplus sys/KanbanPass123@localhost:1521/XE as sysdba
```

```sql
CREATE USER kanban_user IDENTIFIED BY your_password;
GRANT CONNECT, RESOURCE TO kanban_user;
GRANT UNLIMITED TABLESPACE TO kanban_user;
EXIT;
```

**Using existing Oracle:** Just create the user above.

### 2. Ollama

```bash
# Install Ollama: https://ollama.ai
curl -fsSL https://ollama.ai/install.sh | sh

# Start and pull the model
ollama serve &
ollama pull qwen3:0.6b
```

### 3. Server Configuration

```bash
cd server
cp .env.example .env
# Edit .env with your Oracle credentials
```

```env
ORACLE_USER=kanban_user
ORACLE_PASSWORD=your_password
ORACLE_CONNECTION_STRING=localhost:1521/XEPDB1
PORT=3001
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:0.6b
```

### 4. Install & Initialize

```bash
# From project root
npm install
cd server && npm install && npm run db:init  # Creates schema + seeds sample data
cd ../client && npm install
```

### 5. Run

```bash
# From project root - starts both server (3001) and client (5173)
npm run dev

# Or separately:
cd server && npm run dev    # http://localhost:3001
cd client && npm run dev    # http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## API Reference

### Boards
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/boards` | List all boards |
| GET | `/api/boards/:id` | Get board with columns, swimlanes, cards |
| POST | `/api/boards` | Create board (auto-creates 4 default columns) |
| PUT | `/api/boards/:id` | Update board |
| DELETE | `/api/boards/:id` | Delete board (cascades) |

### Cards
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cards/board/:boardId` | Get all cards for a board |
| GET | `/api/cards/:id` | Get card with checklist, comments, move history |
| POST | `/api/cards` | Create card |
| PATCH | `/api/cards/:id` | Update card fields |
| PATCH | `/api/cards/:id/move` | Move card (enforces WIP + DoD) |
| DELETE | `/api/cards/:id` | Delete card |

**Move Card Response codes:**
- `200` - Success
- `409 WIP_LIMIT_EXCEEDED` - Target column at capacity
- `409 DOD_NOT_MET` - Incomplete checklist blocking "Done" move

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/board/:boardId` | Full metrics (lead/cycle time, throughput, WIP, workload) |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/chat` | Chat with board context |
| GET | `/api/ai/suggest/:boardId` | Auto-generate 3 improvement suggestions |

---

## Oracle Schema

```
kanban_boards         - Top-level containers
kanban_columns        - Workflow stages with WIP limits
kanban_swimlanes      - Horizontal categorizers
kanban_cards          - Work items with full metadata
kanban_checklist_items - Definition of Done criteria
kanban_comments       - Card discussion
kanban_card_moves     - Audit log of all movements
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` in AI chat | Send message |
| `Shift+Enter` | New line in AI chat |
| `Escape` | Close modal |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 18, Express 4, TypeScript 5 |
| Database | Oracle Database (oracledb v6) |
| Frontend | React 18, TypeScript, Vite |
| State | Zustand |
| Drag & Drop | @dnd-kit |
| Charts | Recharts |
| AI | Ollama (qwen3:0.6b) |
| Styling | Custom CSS (industrial dark theme) |
