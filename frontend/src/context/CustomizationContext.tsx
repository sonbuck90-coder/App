import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CustomColors {
  primary: string;
  accent: string;
  header: string;
  gradientStart: string;
  gradientEnd: string;
}

export interface LogoSettings {
  url: string;
  size: 'small' | 'medium' | 'large' | 'xlarge';
}

export interface CustomizationSettings {
  colors: CustomColors;
  logo: LogoSettings;
  bankPhone: string;
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
};

const LOGO_SIZES = { small: 44, medium: 72, large: 110, xlarge: 160 };

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
  updateColors: (colors: Partial<CustomColors>) => void;
  updateLogo: (logo: Partial<LogoSettings>) => void;
  updateBankPhone: (phone: string) => void;
  resetToDefaults: () => void;
  isCustomized: boolean;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

const STORAGE_KEY = 'hsbc_customization';

export function CustomizationProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CustomizationSettings>(HSBC_DEFAULTS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({
          ...HSBC_DEFAULTS,
          ...parsed,
          colors: { ...HSBC_DEFAULTS.colors, ...(parsed.colors || {}) },
          logo: { ...HSBC_DEFAULTS.logo, ...(parsed.logo || {}) },
          bankPhone: parsed.bankPhone || HSBC_DEFAULTS.bankPhone,
        });
      }
    } catch (e) {
      console.error('Error loading customization:', e);
    }
  };

  const saveSettings = async (newSettings: CustomizationSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
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
        updateColors,
        updateLogo,
        updateBankPhone,
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
