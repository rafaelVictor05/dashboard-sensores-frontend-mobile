import React, { createContext, useContext, ReactNode } from 'react';
import { darkColors } from './theme';

const ThemeContext = createContext(darkColors);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => (
  <ThemeContext.Provider value={darkColors}>
    {children}
  </ThemeContext.Provider>
);

export const useTheme = () => useContext(ThemeContext);
