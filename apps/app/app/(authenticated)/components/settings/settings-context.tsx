"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type SettingsTab =
  | "account"
  | "settings"
  | "usage"
  | "billing"
  | "scheduled-tasks"
  | "mail"
  | "data-controls"
  | "personalization"
  | "skills"
  | "connectors"
  | "integrations"
  | "help";

type SettingsContextType = {
  isOpen: boolean;
  activeTab: SettingsTab;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setActiveTab: (tab: SettingsTab) => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

type SettingsProviderProps = {
  readonly children: ReactNode;
};

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("settings");

  const openSettings = useCallback((tab: SettingsTab = "settings") => {
    setActiveTab(tab);
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        isOpen,
        activeTab,
        openSettings,
        closeSettings,
        setActiveTab,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
