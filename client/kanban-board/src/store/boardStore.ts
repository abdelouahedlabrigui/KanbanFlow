import { create } from 'zustand';
import type { Board, Card, Column, Swimlane, Analytics } from '../types';
import { boardsApi, analyticsApi } from '../utils/api';

interface BoardStore {
  boards: Board[];
  currentBoard: Board | null;
  analytics: Analytics | null;
  loading: boolean;
  error: string | null;

  fetchBoards: () => Promise<void>;
  fetchBoard: (id: string) => Promise<void>;
  fetchAnalytics: (boardId: string) => Promise<void>;
  setBoard: (board: Board) => void;
  updateCard: (card: Card) => void;
  removeCard: (cardId: string) => void;
  addCard: (card: Card) => void;
  updateColumn: (column: Column) => void;
  updateSwimlane: (swimlane: Swimlane) => void;
  clearError: () => void;
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  boards: [],
  currentBoard: null,
  analytics: null,
  loading: false,
  error: null,

  fetchBoards: async () => {
    set({ loading: true, error: null });
    try {
      const boards = await boardsApi.getAll();
      set({ boards, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchBoard: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const board = await boardsApi.get(id);
      set({ currentBoard: board, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchAnalytics: async (boardId: string) => {
    try {
      const analytics = await analyticsApi.getForBoard(boardId);
      set({ analytics });
    } catch (err) {
      console.error('Analytics fetch failed:', err);
    }
  },

  setBoard: (board) => set({ currentBoard: board }),

  updateCard: (updatedCard) => {
    const board = get().currentBoard;
    if (!board) return;
    set({
      currentBoard: {
        ...board,
        cards: board.cards?.map((c) => (c.ID === updatedCard.ID ? updatedCard : c)),
      },
    });
  },

  removeCard: (cardId) => {
    const board = get().currentBoard;
    if (!board) return;
    set({
      currentBoard: {
        ...board,
        cards: board.cards?.filter((c) => c.ID !== cardId),
      },
    });
  },

  addCard: (card) => {
    const board = get().currentBoard;
    if (!board) return;
    set({
      currentBoard: {
        ...board,
        cards: [...(board.cards ?? []), card],
      },
    });
  },

  updateColumn: (updatedCol) => {
    const board = get().currentBoard;
    if (!board) return;
    set({
      currentBoard: {
        ...board,
        columns: board.columns?.map((c) => (c.ID === updatedCol.ID ? updatedCol : c)),
      },
    });
  },

  updateSwimlane: (updatedLane) => {
    const board = get().currentBoard;
    if (!board) return;
    set({
      currentBoard: {
        ...board,
        swimlanes: board.swimlanes?.map((s) => (s.ID === updatedLane.ID ? updatedLane : s)),
      },
    });
  },

  clearError: () => set({ error: null }),
}));
