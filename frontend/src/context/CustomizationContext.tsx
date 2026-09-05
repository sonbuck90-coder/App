import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userScopedKey, migrateLegacyIfNeeded, onActiveUserChange } from '../services/user-scope';

export interface CustomColors {
  primary: string;
  accent: string;
  header: string;
  gradientStart: string;
  gradientEnd: string;
}

export interface LogoSettings {
  url: string;
  size: 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'huge' | 'massive' | 'giant';
}

export interface CustomizationSettings {
  colors: CustomColors;
  logo: LogoSettings;
  bankPhone: string;
  bankThemeId: string;
  /** Per-theme default logo URLs — key is bankThemeId, value is a data URI
   *  or remote image URL. Set via "Save as default for this theme" in
   *  Customization. When the user switches theme (applyBankTheme) the
   *  matching entry is applied automatically. */
  themeLogos?: Record<string, string>;
}

const HSBC_DEFAULTS: CustomizationSettings = {
  colors: {
    primary: '#DB0011',
    accent: '#00847F',
    header: '#FFFFFF',
    gradientStart: '#DB0011',
    gradientEnd: '#8B0000',
  },
  logo: {
    url: '',
    size: 'large',
  },
  // HSBC UK Personal Banking customer service line
  bankPhone: '03457 404 404',
  bankThemeId: 'hsbc',
  themeLogos: {},
};

const LOGO_SIZES = {
  small: 44,
  medium: 72,
  large: 110,
  xlarge: 160,
  xxlarge: 220,
  huge: 300,
  massive: 400,
  giant: 520,
};

// Compute a readable text colour for the given background hex
function computeHeaderTextColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#FFFFFF';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.6 ? '#0B1424' : '#FFFFFF';
}

interface CustomizationContextType {
  settings: CustomizationSettings;
  colors: CustomColors;
  logoSize: number;
  headerTextColor: string;
  bankPhone: string;
  bankThemeId: string;
  updateColors: (colors: Partial<CustomColors>) => void;
  updateLogo: (logo: Partial<LogoSettings>) => void;
  updateBankPhone: (phone: string) => void;
  applyBankTheme: (themeId: string, colors: CustomColors) => void;
  /** Save the currently-selected logo URL as the default for the given
   *  bank theme. When the user later switches to that theme, this logo
   *  is applied automatically. */
  setThemeDefaultLogo: (themeId: string, url: string) => void;
  /** Remove the saved default logo for a specific theme. */
  clearThemeDefaultLogo: (themeId: string) => void;
  resetToDefaults: () => void;
  isCustomized: boolean;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

const STORAGE_KEY = 'hsbc_customization';

export function CustomizationProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CustomizationSettings>(HSBC_DEFAULTS);

  useEffect(() => {
    loadSettings();
    // Reload from storage whenever the active user is switched so each
    // user keeps their own theme + logo + bank-phone unchanged.
    const unsubscribe = onActiveUserChange(async () => {
      await loadSettings();
    });
    return () => { unsubscribe(); };
  }, []);

  const loadSettings = async () => {
    try {
      await migrateLegacyIfNeeded(STORAGE_KEY);
      const key = await userScopedKey(STORAGE_KEY);
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({
          ...HSBC_DEFAULTS,
          ...parsed,
          colors: { ...HSBC_DEFAULTS.colors, ...(parsed.colors || {}) },
          logo: { ...HSBC_DEFAULTS.logo, ...(parsed.logo || {}) },
          bankPhone: parsed.bankPhone || HSBC_DEFAULTS.bankPhone,
        });
      } else {
        // Fresh user → start them on the HSBC defaults rather than
        // inheriting the previous user's theme.
        setSettings(HSBC_DEFAULTS);
      }
    } catch (e) {
      console.error('Error loading customization:', e);
    }
  };

  const saveSettings = async (newSettings: CustomizationSettings) => {
    try {
      const key = await userScopedKey(STORAGE_KEY);
      await AsyncStorage.setItem(key, JSON.stringify(newSettings));
    } catch (e) {
      console.error('Error saving customization:', e);
    }
  };

  const updateColors = (partial: Partial<CustomColors>) => {
    const updated = { ...settings, colors: { ...settings.colors, ...partial } };
    setSettings(updated);
    saveSettings(updated);
  };

  const updateLogo = (partial: Partial<LogoSettings>) => {
    const updated = { ...settings, logo: { ...settings.logo, ...partial } };
    setSettings(updated);
    saveSettings(updated);
  };

  const updateBankPhone = (phone: string) => {
    const updated = { ...settings, bankPhone: phone };
    setSettings(updated);
    saveSettings(updated);
  };

  const applyBankTheme = (themeId: string, colorsP: CustomColors) => {
    // If the user has previously saved a default logo for this theme, load
    // it — otherwise clear the current logo so a fresh switch doesn't leak
    // the previous theme's photo.
    const themeLogos = settings.themeLogos || {};
    const savedLogo = themeLogos[themeId];
    const updated: CustomizationSettings = {
      ...settings,
      bankThemeId: themeId,
      colors: { ...colorsP },
      logo: {
        ...settings.logo,
        url: savedLogo !== undefined ? savedLogo : '',
      },
    };
    setSettings(updated);
    saveSettings(updated);
  };

  const setThemeDefaultLogo = (themeId: string, url: string) => {
    const themeLogos = { ...(settings.themeLogos || {}), [themeId]: url };
    const updated: CustomizationSettings = {
      ...settings,
      themeLogos,
      // Also apply immediately so preview reflects the change.
      logo: { ...settings.logo, url },
    };
    setSettings(updated);
    saveSettings(updated);
  };

  const clearThemeDefaultLogo = (themeId: string) => {
    const themeLogos = { ...(settings.themeLogos || {}) };
    delete themeLogos[themeId];
    const updated: CustomizationSettings = {
      ...settings,
      themeLogos,
    };
    setSettings(updated);
    saveSettings(updated);
  };

  const resetToDefaults = () => {
    setSettings(HSBC_DEFAULTS);
    saveSettings(HSBC_DEFAULTS);
  };

  const isCustomized = JSON.stringify(settings) !== JSON.stringify(HSBC_DEFAULTS);

  return (
    <CustomizationContext.Provider
      value={{
        settings,
        colors: settings.colors,
        logoSize: LOGO_SIZES[settings.logo.size],
        headerTextColor: computeHeaderTextColor(settings.colors.header),
        bankPhone: settings.bankPhone,
        bankThemeId: settings.bankThemeId || 'hsbc',
        updateColors,
        updateLogo,
        updateBankPhone,
        applyBankTheme,
        setThemeDefaultLogo,
        clearThemeDefaultLogo,
        resetToDefaults,
        isCustomized,
      }}
    >
      {children}
    </CustomizationContext.Provider>
  );
}

export function useCustomization() {
  const ctx = useContext(CustomizationContext);
  if (!ctx) throw new Error('useCustomization must be used within CustomizationProvider');
  return ctx;
}

export { HSBC_DEFAULTS, LOGO_SIZES };
