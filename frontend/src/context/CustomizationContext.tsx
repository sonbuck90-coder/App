import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CustomColors {
  primary: string;
  accent: string;
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
}

const HSBC_DEFAULTS: CustomizationSettings = {
  colors: {
    primary: '#DB0011',
    accent: '#00847F',
    gradientStart: '#DB0011',
    gradientEnd: '#8B0000',
  },
  logo: {
    url: '',
    size: 'medium',
  },
};

const LOGO_SIZES = { small: 28, medium: 40, large: 64, xlarge: 80 };

interface CustomizationContextType {
  settings: CustomizationSettings;
  colors: CustomColors;
  logoSize: number;
  updateColors: (colors: Partial<CustomColors>) => void;
  updateLogo: (logo: Partial<LogoSettings>) => void;
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
        setSettings({ ...HSBC_DEFAULTS, ...parsed, colors: { ...HSBC_DEFAULTS.colors, ...parsed.colors }, logo: { ...HSBC_DEFAULTS.logo, ...parsed.logo } });
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
        updateColors,
        updateLogo,
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
