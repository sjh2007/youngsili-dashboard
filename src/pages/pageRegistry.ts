export const PAGE_IDS = [
  'dashboard', 'elders', 'safety', 'schedule', 'script', 'calls', 'health',
  'casenotes', 'forms', 'report', 'data', 'admin', 'help', 'detail', 'register',
] as const;

export type PageId = (typeof PAGE_IDS)[number];

export function pageFromHash(hash = window.location.hash): PageId {
  const value = hash.replace(/^#/, '') as PageId;
  return PAGE_IDS.includes(value) ? value : 'dashboard';
}
