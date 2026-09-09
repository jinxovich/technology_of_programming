import type { Department, Me } from './types';

export const state = {
  me: null as Me | null,
  departments: [] as Department[],
  page: 'news' as 'news' | 'work',
};
