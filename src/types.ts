export interface Entry {
  id: number;
  type: 'idea' | 'task' | 'note' | 'insight';
  title: string;
  content: string;
  tags: string[];
  project: string;
  priority: number;
  status: 'active' | 'completed' | 'archived';
  related_ids: number[];
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface MindMapNode {
  id: number;
  entry_id: number | null;
  parent_id: number | null;
  label: string;
  x: number;
  y: number;
  children?: MindMapNode[];
}

export interface PomodoroSession {
  id: number;
  entry_id: number | null;
  duration_minutes: number;
  completed: boolean;
  started_at: string;
  finished_at: string | null;
}

export interface EntryComment {
  id: number;
  entry_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeInsight {
  connections: string[];
  summary: string;
  suggestions: string[];
}
