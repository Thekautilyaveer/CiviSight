import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Dark theme has been removed — the app always renders in light mode.
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('darkMode');
  }, []);

  return (
    <ThemeContext.Provider value={{ darkMode: false, toggleDarkMode: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
};

