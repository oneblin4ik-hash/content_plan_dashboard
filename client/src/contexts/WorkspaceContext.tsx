import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { trpc } from "@/lib/trpc";

const STORAGE_KEY = "serbolin.studio.workspaceKey";

type Ctx = {
  workspaceKey: string;
  setWorkspaceKey: (k: string) => void;
  generateNew: () => string;
  /** True when the server has Cloudflare D1 configured — sync goes to cloud. */
  cloudEnabled: boolean;
  /** Loading state for the initial status probe. */
  ready: boolean;
};

const WorkspaceContext = createContext<Ctx | null>(null);

function makeKey(): string {
  // workspace keys are short user-facing strings: 8 base32 chars
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaceKey, setKeyState] = useState<string>("");

  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      setKeyState(existing);
    } else {
      const k = makeKey();
      localStorage.setItem(STORAGE_KEY, k);
      setKeyState(k);
    }
  }, []);

  const status = trpc.sync.status.useQuery(undefined, {
    staleTime: 60_000,
  });

  const setWorkspaceKey = (k: string) => {
    const cleaned = k.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length < 6) return;
    localStorage.setItem(STORAGE_KEY, cleaned);
    setKeyState(cleaned);
    // Reload caches so the new workspace's data is pulled.
    window.location.reload();
  };

  const generateNew = () => {
    const k = makeKey();
    localStorage.setItem(STORAGE_KEY, k);
    setKeyState(k);
    window.location.reload();
    return k;
  };

  const value = useMemo<Ctx>(
    () => ({
      workspaceKey,
      setWorkspaceKey,
      generateNew,
      cloudEnabled: Boolean(status.data?.enabled),
      ready: !status.isLoading && workspaceKey.length > 0,
    }),
    [workspaceKey, status.data?.enabled, status.isLoading]
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
