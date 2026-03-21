import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

export interface ModuleSelection {
  productId: string;
  moduleId: string;
  tier: string;
}

interface SignupState {
  accountCreated: boolean;
  twoFactorComplete: boolean;
  companyName: string;
  companySlug: string;
  billingEmail: string;
  billingInterval: "monthly" | "annual";
  selectedModules: ModuleSelection[];
}

interface SignupContextValue extends SignupState {
  setAccountCreated: (v: boolean) => void;
  setTwoFactorComplete: (v: boolean) => void;
  setCompanyName: (v: string) => void;
  setCompanySlug: (v: string) => void;
  setBillingEmail: (v: string) => void;
  setBillingInterval: (v: "monthly" | "annual") => void;
  setSelectedModules: (v: ModuleSelection[]) => void;
  toggleModule: (mod: ModuleSelection) => void;
  updateModuleTier: (moduleId: string, tier: string) => void;
}

const SignupContext = createContext<SignupContextValue | null>(null);

export function SignupProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [accountCreated, setAccountCreated] = useState(false);
  const [twoFactorComplete, setTwoFactorComplete] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [selectedModules, setSelectedModules] = useState<ModuleSelection[]>([]);

  const toggleModule = useCallback((mod: ModuleSelection) => {
    setSelectedModules((prev) => {
      const exists = prev.find((m) => m.moduleId === mod.moduleId);
      if (exists) {
        return prev.filter((m) => m.moduleId !== mod.moduleId);
      }
      return [...prev, mod];
    });
  }, []);

  const updateModuleTier = useCallback((moduleId: string, tier: string) => {
    setSelectedModules((prev) =>
      prev.map((m) => (m.moduleId === moduleId ? { ...m, tier } : m)),
    );
  }, []);

  const value = useMemo((): SignupContextValue => ({
    accountCreated,
    twoFactorComplete,
    companyName,
    companySlug,
    billingEmail,
    billingInterval,
    selectedModules,
    setAccountCreated,
    setTwoFactorComplete,
    setCompanyName,
    setCompanySlug,
    setBillingEmail,
    setBillingInterval,
    setSelectedModules,
    toggleModule,
    updateModuleTier,
  }), [
    accountCreated, twoFactorComplete, companyName, companySlug,
    billingEmail, billingInterval, selectedModules, toggleModule, updateModuleTier,
  ]);

  return (
    <SignupContext.Provider value={value}>
      {children}
    </SignupContext.Provider>
  );
}

export function useSignupContext(): SignupContextValue {
  const ctx = useContext(SignupContext);
  if (!ctx) {
    throw new Error("useSignupContext must be used within SignupProvider");
  }
  return ctx;
}
