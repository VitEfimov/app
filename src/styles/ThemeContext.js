import React, { createContext, useContext, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { themeFromSourceColor, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext();

// Helper to convert hex to rgba with alpha
export const hexToRgba = (hex, alpha) => {
  if (!hex || typeof hex !== 'string') return `rgba(128, 128, 128, ${alpha})`;
  let cleanHex = hex.trim();
  if (cleanHex.startsWith('#')) cleanHex = cleanHex.slice(1);
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) return `rgba(128, 128, 128, ${alpha})`;
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const ThemeProvider = ({ children }) => {
  const sourceColor = useSelector((state) => state.themeReducer?.sourceColor);
  const themeMode = useSelector((state) => state.themeReducer?.themeMode);
  const systemColorScheme = useColorScheme();

  const theme = useMemo(() => {
    // Default fallback color if none provided
    const colorToUse = sourceColor || '#6750A4';
    
    const matTheme = themeFromSourceColor(argbFromHex(colorToUse));
    // Determine if we should use dark scheme
    let isDark = false;
    if (themeMode === 'system') {
      isDark = systemColorScheme === 'dark';
    } else {
      isDark = themeMode === 'dark' || themeMode === 'contrast';
    }
    const scheme = isDark ? matTheme.schemes.dark : matTheme.schemes.light;

    const primaryHex = hexFromArgb(scheme.primary);

    // Build our custom color mapping similar to CSS variables
    const colors = {
      primary: primaryHex,
      primaryContainer: hexFromArgb(scheme.primaryContainer),
      onPrimary: hexFromArgb(scheme.onPrimary),
      onPrimaryContainer: hexFromArgb(scheme.onPrimaryContainer),
      primaryLight: hexToRgba(primaryHex, 0.4),
      textInverse: hexFromArgb(scheme.onPrimary),
      textTertiary: hexFromArgb(scheme.onSurfaceVariant),
      secondary: hexFromArgb(scheme.secondary),
      onSecondary: hexFromArgb(scheme.onSecondary),
      secondaryContainer: hexFromArgb(scheme.secondaryContainer),
      onSecondaryContainer: hexFromArgb(scheme.onSecondaryContainer),
      tertiary: hexFromArgb(scheme.tertiary),
      onTertiary: hexFromArgb(scheme.onTertiary),
      tertiaryContainer: hexFromArgb(scheme.tertiaryContainer),
      onTertiaryContainer: hexFromArgb(scheme.onTertiaryContainer),
      surface: hexFromArgb(scheme.surface),
      onSurface: hexFromArgb(scheme.onSurface),
      onSurfaceVariant: hexFromArgb(scheme.onSurfaceVariant),
      outline: hexFromArgb(scheme.outline),
      outlineVariant: hexFromArgb(scheme.outlineVariant),
    };

    if (themeMode === 'contrast') {
      colors.bgMain = '#000000';
      colors.bgSidebar = '#0a0a0a';
      colors.bgCard = '#141414';
      colors.bgHeader = '#0a0a0a';
      colors.surfaceContainer = '#121212';
      colors.surfaceContainerHigh = '#202020';
      colors.surfaceContainerHighest = '#2a2a2a';
      colors.cardBg = '#141414';
      colors.cardBorder = primaryHex;
      colors.textPrimary = '#ffffff';
      colors.textSecondary = '#dddddd';
      colors.borderColor = primaryHex;
      colors.danger = '#ff3333';
      colors.errorContainer = '#3b0d0d';
      colors.onErrorContainer = '#ff9999';
    } else {
      colors.bgMain = isDark ? hexFromArgb(matTheme.palettes.neutral.tone(16)) : hexFromArgb(matTheme.palettes.neutral.tone(94));
      colors.bgSidebar = hexFromArgb(scheme.surfaceVariant);
      colors.bgCard = hexFromArgb(scheme.surface);
      colors.bgHeader = hexFromArgb(scheme.surface);
      colors.surfaceContainer = isDark ? hexFromArgb(matTheme.palettes.neutral.tone(12)) : hexFromArgb(matTheme.palettes.neutral.tone(94));
      colors.surfaceContainerHigh = isDark ? hexFromArgb(matTheme.palettes.neutral.tone(17)) : hexFromArgb(matTheme.palettes.neutral.tone(90));
      colors.surfaceContainerHighest = isDark ? hexFromArgb(matTheme.palettes.neutral.tone(22)) : hexFromArgb(matTheme.palettes.neutral.tone(86));
      colors.cardBg = isDark ? hexFromArgb(matTheme.palettes.neutral.tone(12)) : hexFromArgb(matTheme.palettes.neutral.tone(96));
      colors.cardBorder = isDark ? hexFromArgb(matTheme.palettes.neutralVariant.tone(26)) : hexFromArgb(matTheme.palettes.neutralVariant.tone(86));
      colors.textPrimary = hexFromArgb(scheme.onSurface);
      colors.textSecondary = hexFromArgb(scheme.onSurfaceVariant);
      colors.borderColor = isDark ? hexFromArgb(matTheme.palettes.neutralVariant.tone(26)) : hexFromArgb(matTheme.palettes.neutralVariant.tone(86));
      colors.danger = hexFromArgb(scheme.error);
      colors.errorContainer = hexFromArgb(scheme.errorContainer);
      colors.onErrorContainer = hexFromArgb(scheme.onErrorContainer);
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
