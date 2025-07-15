import { useCommandPalette } from '@/components/context/command-palette-context';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { enhancedKeyboardShortcuts } from '@/config/shortcuts';
import { addComposeTabAtom } from '@/store/composeTabsStore';
import { useShortcuts } from './use-hotkey-utils';
import { useQueryState } from 'nuqs';
import { useSetAtom } from 'jotai';

export function GlobalHotkeys() {
  const { clearAllFilters } = useCommandPalette();
  const [, setIsCommandPaletteOpen] = useQueryState('isCommandPaletteOpen');
  const { undoLastAction } = useOptimisticActions();
  const addTab = useSetAtom(addComposeTabAtom);
  const scope = 'global';

  const handlers = {
    newEmail: () => addTab({}),
    commandPalette: () => setIsCommandPaletteOpen('true'),
    clearAllFilters: () => clearAllFilters(),
    undoLastAction: () => {
      undoLastAction();
    },
  };

  const globalShortcuts = enhancedKeyboardShortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(globalShortcuts, handlers, { scope });

  return null;
}
