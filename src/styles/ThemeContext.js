import React, { createContext, useContext, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { themeFromSourceColor, argbFromHex, hexFromArgb } from '@material/material-color-utilities';

const ThemeContext = createContext();

// Helper to convert hex to rgba with alpha
const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const ThemeProvider = ({ children }) => {
  const { sourceColor, themeMode } = useSelector((state) => state.themeReducer || {});

  const theme = useMemo(() => {
    // Default fallback color if none provided
    const colorToUse = sourceColor || '#6750A4';
    
    const matTheme = themeFromSourceColor(argbFromHex(colorToUse));
    // Determine if we should use dark scheme
    const isDark = themeMode === 'dark' || themeMode === 'contrast';
    const scheme = isDark ? matTheme.schemes.dark : matTheme.schemes.light;

    const primaryHex = hexFromArgb(scheme.primary);

    // Build our custom color mapping similar to CSS variables
    const colors = {
      primary: primaryHex,
      primaryContainer: hexFromArgb(scheme.primaryContainer),
      primaryLight: hexToRgba(primaryHex, 0.4),
      textInverse: hexFromArgb(scheme.onPrimary),
      textTertiary: hexFromArgb(scheme.onSurfaceVariant),
    };

    if (themeMode === 'contrast') {
      colors.bgMain = '#000000';
      colors.bgSidebar = '#0a0a0a';
      colors.bgCard = '#141414';
      colors.bgHeader = '#0a0a0a';
      colors.surfaceContainer = '#0a0a0a';
      colors.surfaceContainerHigh = '#222222';
      colors.textPrimary = '#ffffff';
      colors.textSecondary = '#dddddd';
      colors.borderColor = primaryHex;
      colors.danger = '#ff3333';
    } else {
      colors.bgMain = isDark ? hexFromArgb(matTheme.palettes.neutral.tone(12)) : hexFromArgb(matTheme.palettes.primary.tone(95));
      colors.bgSidebar = hexFromArgb(scheme.surfaceVariant);
      colors.bgCard = hexFromArgb(scheme.surface);
      colors.bgHeader = hexFromArgb(scheme.surface);
      colors.surfaceContainer = hexToRgba(primaryHex, 0.1);
      colors.surfaceContainerHigh = hexToRgba(primaryHex, 0.2);
      colors.textPrimary = hexFromArgb(scheme.onSurface);
      colors.textSecondary = hexFromArgb(scheme.onSurfaceVariant);
      colors.borderColor = hexToRgba(primaryHex, 0.2);
      colors.danger = hexFromArgb(scheme.error);
    }

    return {
      colors,
      isDark,
      mode: themeMode
    };
  }, [sourceColor, themeMode]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
