import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  PRODUCT_CONFIG,
  type ProductId,
} from "@opshield/shared/constants";

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
  enabledProducts: Set<string>;
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
  toggleProduct: (productId: ProductId) => void;
  isProductEnabled: (productId: string) => boolean;
}

const SignupContext = createContext<SignupContextValue | null>(null);

/**
 * Get all module IDs that depend on a given module or product being active.
 */
function getDependentModuleIds(
  moduleId: string | null,
  productId: string | null,
): string[] {
  const dependents: string[] = [];
  for (const [, product] of Object.entries(PRODUCT_CONFIG)) {
    for (const addon of product.addons) {
      if (moduleId && addon.requires === moduleId) {
        dependents.push(addon.id);
      }
      if (productId && addon.requiresProduct === productId) {
        dependents.push(addon.id);
      }
    }
  }
  return dependents;
}

export function SignupProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [accountCreated, setAccountCreated] = useState(false);
  const [twoFactorComplete, setTwoFactorComplete] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingInterval, setBillingInterval] = useState<
    "monthly" | "annual"
  >("monthly");
  const [selectedModules, setSelectedModules] = useState<ModuleSelection[]>(
    [],
  );
  const [enabledProducts, setEnabledProducts] = useState<Set<string>>(
    new Set(),
  );

  const toggleModule = useCallback((mod: ModuleSelection) => {
    setSelectedModules((prev) => {
      const exists = prev.find((m) => m.moduleId === mod.moduleId);
      if (exists) {
        // Removing — also remove anything that depends on this module
        const dependents = getDependentModuleIds(mod.moduleId, null);
        return prev.filter(
          (m) =>
            m.moduleId !== mod.moduleId && !dependents.includes(m.moduleId),
        );
      }
      return [...prev, mod];
    });
  }, []);

  const updateModuleTier = useCallback(
    (moduleId: string, tier: string) => {
      setSelectedModules((prev) =>
        prev.map((m) => (m.moduleId === moduleId ? { ...m, tier } : m)),
      );
    },
    [],
  );

  const toggleProduct = useCallback(
    (productId: ProductId) => {
      setEnabledProducts((prev) => {
        const next = new Set(prev);
        if (next.has(productId)) {
          // Turning OFF — remove all modules for this product
          next.delete(productId);

          // Also collect cross-product dependents
          const crossDependents = getDependentModuleIds(null, productId);

          setSelectedModules((prevMods) =>
            prevMods.filter(
              (m) =>
                m.productId !== productId &&
                !crossDependents.includes(m.moduleId),
            ),
          );
        } else {
          // Turning ON — auto-add required base modules with default tier
          next.add(productId);

          const config = PRODUCT_CONFIG[productId];
          const requiredModules: ModuleSelection[] = [];
          for (const baseMod of config.baseModules) {
            const firstTier = baseMod.tiers[0];
            if (baseMod.required && firstTier) {
              requiredModules.push({
                productId,
                moduleId: baseMod.id,
                tier: firstTier.id,
              });
            }
          }

          if (requiredModules.length > 0) {
            setSelectedModules((prevMods) => {
              const newMods = [...prevMods];
              for (const rm of requiredModules) {
                if (!newMods.some((m) => m.moduleId === rm.moduleId)) {
                  newMods.push(rm);
                }
              }
              return newMods;
            });
          }
        }
        return next;
      });
    },
    [],
  );

  const isProductEnabled = useCallback(
    (productId: string): boolean => enabledProducts.has(productId),
    [enabledProducts],
  );

  const value = useMemo(
    (): SignupContextValue => ({
      accountCreated,
      twoFactorComplete,
      companyName,
      companySlug,
      billingEmail,
      billingInterval,
      selectedModules,
      enabledProducts,
      setAccountCreated,
      setTwoFactorComplete,
      setCompanyName,
      setCompanySlug,
      setBillingEmail,
      setBillingInterval,
      setSelectedModules,
      toggleModule,
      updateModuleTier,
      toggleProduct,
      isProductEnabled,
    }),
    [
      accountCreated,
      twoFactorComplete,
      companyName,
      companySlug,
      billingEmail,
      billingInterval,
      selectedModules,
      enabledProducts,
      toggleModule,
      updateModuleTier,
      toggleProduct,
      isProductEnabled,
    ],
  );

  return (
    <SignupContext.Provider value={value}>{children}</SignupContext.Provider>
  );
}

export function useSignupContext(): SignupContextValue {
  const ctx = useContext(SignupContext);
  if (!ctx) {
    throw new Error("useSignupContext must be used within SignupProvider");
  }
  return ctx;
}
