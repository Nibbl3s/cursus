import { WorldTheme } from './types';
import { medievalTheme } from './medieval';
import { spaceTheme } from './space';
import { cyberTheme } from './cyber';

export type ThemeId = 'medieval' | 'space' | 'cyber';

export const themes: Record<ThemeId, WorldTheme> = {
  medieval: medievalTheme,
  space: spaceTheme,
  cyber: cyberTheme,
};

export { medievalTheme, spaceTheme, cyberTheme };
export type { WorldTheme };
