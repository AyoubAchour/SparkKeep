import { StyleSheet } from 'react-native';
import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

// Font family constants
export const fonts = {
  light: 'SpaceGrotesk_300Light',
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semiBold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
} as const;

// Typography presets
export const typography = {
  // Headers
  h1: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 40,
  },
  h2: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 36,
  },
  h3: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 32,
  },
  h4: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    lineHeight: 28,
  },
  // Body
  bodyLarge: {
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 26,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  // Labels/Buttons
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  labelSmall: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 24,
  },
  buttonSmall: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  // Caption
  caption: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
} as const;

export type Theme = {
  colors: {
    bg: string;
    card: string;
    text: string;
    textSecondary: string;
    muted: string;
    border: string;
    borderLight: string;
    success: string;
    successBg: string;
    danger: string;
    dangerBg: string;
    warning: string;
    warningBg: string;
    primary: string;
    primaryDark: string;
    bgSecondary: string;
    yellow: string;
    cyan: string;
    lime: string;
    pink: string;
    black: string;
    white: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  borderRadius: {
    none: number;
    sm: number;
    md: number;
    lg: number;
  };
  shadow: {
    small: { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
    medium: { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
  };
};

const light: Theme = {
  colors: {
    bg: '#FAFAFA',
    card: '#FFFFFF',
    text: '#000000',
    textSecondary: '#666666',
    muted: '#999999',
    border: '#000000',
    borderLight: '#e5e7eb',
    success: '#28a745',
    successBg: '#d4edda',
    danger: '#dc3545',
    dangerBg: '#f8d7da',
    warning: '#FFED00',
    warningBg: '#fff3cd',
    primary: '#00E5FF',
    primaryDark: '#00b8cc',
    bgSecondary: '#f5f5f5',
    yellow: '#FFED00',
    cyan: '#00E5FF',
    lime: '#C8FF00',
    pink: '#FF006B',
    black: '#000000',
    white: '#FFFFFF',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  borderRadius: {
    none: 0,
    sm: 8,
    md: 16,
    lg: 24,
  },
  shadow: {
    small: {
      shadowColor: '#000000',
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 0,
    },
    medium: {
      shadowColor: '#000000',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 0,
    },
  },
};

const dark: Theme = {
  colors: {
    bg: '#0b0f1a',
    card: '#121826',
    text: '#e5e7eb',
    textSecondary: '#9ca3af',
    muted: '#6b7280',
    border: '#1f2937',
    borderLight: '#374151',
    success: '#4ade80',
    successBg: '#1a3a2a',
    danger: '#f87171',
    dangerBg: '#3a1a1a',
    warning: '#fbbf24',
    warningBg: '#3a2f1a',
    primary: '#60a5fa',
    primaryDark: '#3b82f6',
    bgSecondary: '#1f2937',
    yellow: '#FFED00',
    cyan: '#00E5FF',
    lime: '#C8FF00',
    pink: '#FF006B',
    black: '#000000',
    white: '#FFFFFF',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  borderRadius: {
    none: 0,
    sm: 8,
    md: 16,
    lg: 24,
  },
  shadow: {
    small: {
      shadowColor: '#000000',
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 0,
    },
    medium: {
      shadowColor: '#000000',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 0,
    },
  },
};

const ThemeCtx = createContext<Theme>(light);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode] = useState<'light' | 'dark'>('light');
  const theme = useMemo(() => (mode === 'light' ? light : dark), [mode]);
  return <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}

// Status management helpers
export function getStatusColor(status: string): string {
  switch (status) {
    case 'INBOX': return '#6c757d';
    case 'BACKLOG': return '#007bff';
    case 'IN_PROGRESS': return '#ffc107';
    case 'DONE': return '#28a745';
    default: return '#6c757d';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'INBOX': return 'Inbox';
    case 'BACKLOG': return 'To Do';
    case 'IN_PROGRESS': return 'In Progress';
    case 'DONE': return 'Done';
    default: return status;
  }
}
