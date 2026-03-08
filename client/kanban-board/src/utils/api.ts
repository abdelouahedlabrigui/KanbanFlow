import axios from 'axios';
import type { Board, Card, Column, Swimlane, CardDetail, Analytics, AIMessage } from '../types';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });

// Boards
export const boardsApi = {
  getAll: () => api.get<Board[]>('/boards').then((r) => r.data),
  get: (id: string) => api.get<Board>(`/boards/${id}`).then((r) => r.data),
  create: (data: { title: string; description?: string }) =>
    api.post<{ id: string; title: string }>('/boards', data).then((r) => r.data),
  update: (id: string, data: Partial<Board>) => api.put(`/boards/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/boards/${id}`).then((r) => r.data),
};

// Cards
export const cardsApi = {
  getForBoard: (boardId: string) =>
    api.get<Card[]>(`/cards/board/${boardId}`).then((r) => r.data),
  get: (id: string) => api.get<CardDetail>(`/cards/${id}`).then((r) => r.data),
  create: (data: Partial<Card> & { boardId: string; columnId: string; title: string }) =>
    api.post<Card>('/cards', data).then((r) => r.data),
  update: (id: string, data: Partial<Card>) => api.patch<Card>(`/cards/${id}`, data).then((r) => r.data),
  move: (id: string, data: { toColumnId: string; position?: number; movedBy?: string; reason?: string }) =>
    api.patch<{ success: boolean; newStatus: string; isRecycle: number }>(`/cards/${id}/move`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/cards/${id}`).then((r) => r.data),
  addChecklist: (id: string, title: string) =>
    api.post(`/cards/${id}/checklist`, { title }).then((r) => r.data),
  toggleChecklist: (cardId: string, itemId: string) =>
    api.patch(`/cards/${cardId}/checklist/${itemId}`).then((r) => r.data),
  deleteChecklist: (cardId: string, itemId: string) =>
    api.delete(`/cards/${cardId}/checklist/${itemId}`).then((r) => r.data),
  addComment: (id: string, author: string, content: string) =>
    api.post(`/cards/${id}/comments`, { author, content }).then((r) => r.data),
};

// Columns
export const columnsApi = {
  create: (data: Partial<Column> & { boardId: string; title: string }) =>
    api.post<{ id: string }>('/columns', data).then((r) => r.data),
  update: (id: string, data: Partial<Column>) => api.put(`/columns/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/columns/${id}`).then((r) => r.data),
};

// Swimlanes
export const swimlanesApi = {
  create: (data: { boardId: string; title: string; color?: string }) =>
    api.post<{ id: string }>('/swimlanes', data).then((r) => r.data),
  update: (id: string, data: Partial<Swimlane>) => api.put(`/swimlanes/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/swimlanes/${id}`).then((r) => r.data),
};

// Analytics
export const analyticsApi = {
  getForBoard: (boardId: string) =>
    api.get<Analytics>(`/analytics/board/${boardId}`).then((r) => r.data),
};

// AI
export const aiApi = {
  chat: (messages: AIMessage[], boardId?: string) =>
    api.post<{ message: string; model: string }>('/ai/chat', { messages, boardId }).then((r) => r.data),
  suggest: (boardId: string) =>
    api.get<{ suggestions: string }>(`/ai/suggest/${boardId}`).then((r) => r.data),
};

export default api;
