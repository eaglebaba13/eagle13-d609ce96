import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { highestRole, type AppRole } from "./roles";
import { serializeProfile, type ProfileRow, type SerializedProfile } from "./profile";
import {
  clientLocalBypassActive,
  LOCAL_DEV_DISPLAY_NAME,
  LOCAL_DEV_EMAIL,
  LOCAL_DEV_ROLE,
  LOCAL_DEV_USER_ID,
} from "./local-dev-auth";

const LOCAL_DEV_PROFILE: SerializedProfile = {
  id: LOCAL_DEV_USER_ID,
  email: LOCAL_DEV_EMAIL,
  displayName: LOCAL_DEV_DISPLAY_NAME,
  avatarUrl: null,
  timezone: "Asia/Kolkata",
  country: "IN",
  currency: "INR",
  preferredBroker: null,
  preferredInstrument: "NIFTY",
  language: "en",
  theme: "dark",
  role: LOCAL_DEV_ROLE,
};

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: SerializedProfile | null;
  roles: AppRole[];
  role: AppRole;
  isAuthenticated: boolean;
  /** True only on localhost during development (Phase 52D). */
  localDevBypass: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  logAudit: (event: string, metadata?: Record<string, unknown>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<SerializedProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  // Resolved after mount so SSR and the first client render agree.
  const [localDevBypass, setLocalDevBypass] = useState(false);
  const lastEvent = useRef<string | null>(null);

  const loadProfileAndRoles = useCallback(async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const rolesList = (rolesRes.data ?? []).map((r) => r.role as AppRole);
    setRoles(rolesList);
    const primary = highestRole(rolesList.length ? rolesList : ["free"]);
    if (profileRes.data) {
      setProfile(serializeProfile(profileRes.data as ProfileRow, primary));
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    if (clientLocalBypassActive()) {
      setLocalDevBypass(true);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    // 1. Wire the listener FIRST so we don't miss the initial event.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      if (event !== lastEvent.current) {
        lastEvent.current = event;
      }
      if (s?.user) {
        // Defer the profile fetch — never call supabase from inside the callback.
        setTimeout(() => {
          if (!mounted) return;
          void loadProfileAndRoles(s.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    // 2. Then hydrate the current session.
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        void loadProfileAndRoles(data.session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfileAndRoles]);

  const signOut = useCallback(async () => {
    // Phase 20.3A: session isolation — never leak previous user's state.
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setSession(null);
    if (typeof window !== "undefined") {
      // Clear user-scoped ephemeral caches. We deliberately keep the raw
      // eaglebaba.* legacy scopes so re-signing-in with the same user still
      // sees the migration assistant.
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfileAndRoles(session.user.id);
  }, [session, loadProfileAndRoles]);

  const logAudit = useCallback(
    async (event: string, metadata: Record<string, unknown> = {}) => {
      if (!session?.user) return;
      try {
        await supabase
          .from("audit_log")
          .insert({
            user_id: session.user.id,
            event,
            metadata: metadata as never,
          });
      } catch {
        /* audit failures never block UX */
      }
    },
    [session],
  );

  const role = useMemo<AppRole>(
    () => highestRole(roles.length ? roles : ["free"]),
    [roles],
  );

  const value: AuthContextValue = {
    loading: localDevBypass ? false : loading,
    session,
    user: session?.user ?? null,
    profile: localDevBypass ? LOCAL_DEV_PROFILE : profile,
    roles: localDevBypass ? [LOCAL_DEV_ROLE] : roles,
    role: localDevBypass ? LOCAL_DEV_ROLE : role,
    isAuthenticated: localDevBypass ? true : !!session?.user,
    localDevBypass,
    signOut,
    refreshProfile,
    logAudit,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}