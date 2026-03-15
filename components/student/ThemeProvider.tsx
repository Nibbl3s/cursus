'use client';

import { createContext, useContext } from 'react';
import { WorldTheme } from '@/lib/themes/types';
import { themes } from '@/lib/themes';

const ThemeContext = createContext<WorldTheme>(themes.medieval);

export function ThemeProvider({
  themeId,
  children,
}: {
  themeId: string;
  children: React.ReactNode;
}) {
  const theme = themes[themeId as keyof typeof themes] ?? themes.medieval;

  // Inject CSS variables from palette as inline custom properties
  const cssVars = Object.fromEntries(
    Object.entries(theme.palette).map(([k, v]) => [`--color-${k}`, v]),
  ) as React.CSSProperties;

  return (
    <ThemeContext.Provider value={theme}>
      <div style={cssVars} className={`theme-root ${theme.cssTheme}`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

// Usage anywhere in student views:
// const theme = useTheme();
// <h1>{theme.vocabulary.dashboardGreeting}</h1>
// <span>{theme.vocabulary.points}</span>
