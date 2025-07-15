import { atomWithStorage } from 'jotai/utils';
import { atom } from 'jotai';

export interface ComposeTab {
  id: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  draftId?: string | null;
  attachments?: File[];
  createdAt: number;
  lastModified: number;
  isMinimized?: boolean;
}

export const composeTabsAtom = atomWithStorage<Map<string, ComposeTab>>('composeTabs', new Map(), {
  getItem: (key, initialValue): Map<string, ComposeTab> => {
    const stored = localStorage.getItem(key);
    if (!stored) return initialValue;
    try {
      const parsed = JSON.parse(stored);
      return new Map(parsed);
    } catch {
      return initialValue;
    }
  },
  setItem: (key, value) => {
    localStorage.setItem(key, JSON.stringify(Array.from(value.entries())));
  },
  removeItem: (key) => localStorage.removeItem(key),
});

export const activeComposeTabIdAtom = atom<string | null>(null);
export const fullscreenTabIdAtom = atom<string | null>(null);

export const addComposeTabAtom = atom(null, async (get, set, tab: Partial<ComposeTab>) => {
  const tabs = await get(composeTabsAtom);
  const id = `compose-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const newTab: ComposeTab = {
    id,
    createdAt: Date.now(),
    lastModified: Date.now(),
    isMinimized: false,
    ...tab,
  };

  const newTabs = new Map(tabs);
  newTabs.set(id, newTab);
  set(composeTabsAtom, newTabs);
  set(activeComposeTabIdAtom, id);

  return id;
});

export const removeComposeTabAtom = atom(null, async (get, set, tabId: string) => {
  const tabs = await get(composeTabsAtom);
  const newTabs = new Map(tabs);
  newTabs.delete(tabId);
  set(composeTabsAtom, newTabs);

  if (get(fullscreenTabIdAtom) === tabId) {
    set(fullscreenTabIdAtom, null);
  }

  if (get(activeComposeTabIdAtom) === tabId) {
    const remainingTabs = Array.from(newTabs.keys());
    set(
      activeComposeTabIdAtom,
      remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1] : null,
    );
  }
});

export const updateComposeTabAtom = atom(
  null,
  async (get, set, { id, updates }: { id: string; updates: Partial<ComposeTab> }) => {
    const tabs = await get(composeTabsAtom);
    const tab = tabs.get(id);
    if (!tab) return;

    const updatedTab = {
      ...tab,
      ...updates,
      lastModified: Date.now(),
    };

    const newTabs = new Map(tabs);
    newTabs.set(id, updatedTab);
    set(composeTabsAtom, newTabs);
  },
);

export const toggleMinimizeTabAtom = atom(null, async (get, set, tabId: string) => {
  const tabs = await get(composeTabsAtom);
  const tab = tabs.get(tabId);
  if (!tab) return;

  const updatedTab = {
    ...tab,
    isMinimized: !tab.isMinimized,
  };

  const newTabs = new Map(tabs);
  newTabs.set(tabId, updatedTab);
  set(composeTabsAtom, newTabs);

  if (!updatedTab.isMinimized) {
    set(activeComposeTabIdAtom, tabId);
  }
});

export const toggleFullscreenTabAtom = atom(null, (get, set, tabId: string | null) => {
  const currentFullscreen = get(fullscreenTabIdAtom);

  if (currentFullscreen === tabId) {
    set(fullscreenTabIdAtom, null);
  } else {
    set(fullscreenTabIdAtom, tabId);
    if (tabId) {
      set(activeComposeTabIdAtom, tabId);
    }
  }
});
