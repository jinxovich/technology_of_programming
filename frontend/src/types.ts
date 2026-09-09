export type Role = 'admin' | 'chief' | 'editor' | 'author';
export type Status = 'assigned' | 'submitted' | 'rework' | 'approved';

export interface Me {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  role_title: string;
  department_id: number | null;
  department: string | null;
  can: string[];
}

export interface Department {
  id: number;
  name: string;
}

export interface Topic {
  id: number;
  title: string;
  department_id: number;
  department: string;
}

export interface Publication {
  id: number;
  topic_id: number;
  topic: string;
  title: string;
  body: string;
  author_id: number | null;
  author: string | null;
  status: Status;
  note: string;
  department: string;
  department_id: number;
}

export interface AuthorRef {
  id: number;
  full_name: string;
}

/** Что возвращает экран: разметка и подписка на события. */
export interface View {
  html: string;
  wire?: (root: HTMLElement) => void;
}
