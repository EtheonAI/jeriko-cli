"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  | "secrets"
  | "help";

// Valid tab names for URL hash
const validTabs: SettingsTab[] = [
  "account",
  "settings",
  "usage",
  "billing",
  "scheduled-tasks",
  "mail",
  "data-controls",
  "personalization",
  "skills",
  "connectors",
  "integrations",
  "secrets",
  "help",
];

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

// Parse hash to get settings tab: #settings or #settings/account
function parseHash(hash: string): { isSettings: boolean; tab: SettingsTab | null } {
  if (!hash || !hash.startsWith("#settings")) {
    return { isSettings: false, tab: null };
  }

  const parts = hash.slice(1).split("/"); // Remove # and split
  if (parts[0] !== "settings") {
    return { isSettings: false, tab: null };
  }

  if (parts.length === 1) {
    return { isSettings: true, tab: "settings" };
  }

  const tabName = parts[1] as SettingsTab;
  if (validTabs.includes(tabName)) {
    return { isSettings: true, tab: tabName };
  }

  return { isSettings: true, tab: "settings" };
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<SettingsTab>("settings");

  // Handle hash changes for URL-based navigation
  useEffect(() => {
    const handleHashChange = () => {
      const { isSettings, tab } = parseHash(window.location.hash);
      if (isSettings) {
        setIsOpen(true);
        if (tab) {
          setActiveTabState(tab);
        }
      } else if (isOpen) {
        // Only close if we're open and hash doesn't have settings
        // Don't auto-close on hash clear to allow normal closing
      }
    };

    // Check initial hash on mount
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const openSettings = useCallback((tab: SettingsTab = "settings") => {
    setActiveTabState(tab);
    setIsOpen(true);
    // Update URL hash
    if (typeof window !== "undefined") {
      const newHash = tab === "settings" ? "#settings" : `#settings/${tab}`;
      window.history.pushState(null, "", newHash);
    }
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
    // Remove hash from URL
    if (typeof window !== "undefined" && window.location.hash.startsWith("#settings")) {
      window.history.pushState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const setActiveTab = useCallback((tab: SettingsTab) => {
    setActiveTabState(tab);
    // Update URL hash
    if (typeof window !== "undefined" && isOpen) {
      const newHash = tab === "settings" ? "#settings" : `#settings/${tab}`;
      window.history.replaceState(null, "", newHash);
    }
  }, [isOpen]);

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
