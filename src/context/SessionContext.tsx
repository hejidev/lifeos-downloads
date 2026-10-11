import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { clearSession, getShiftStart, saveShiftStart, staffApi, StaffSessionExpiredError } from "../api/client";
import { Button } from "../components/ui";
import { colors } from "../theme";
import type { LoyaltyConfig, MeResponse, Sale, StaffPermission, StaffProfile } from "../types";

interface LoadedSession {
  staff: StaffProfile;
  businessName: string;
  storeName: string;
  currency: string;
  permissions: StaffPermission[];
  loyalty: LoyaltyConfig;
  shiftStart: Date;
}

interface SessionValue extends LoadedSession {
  recentSales: Sale[];
  can: (permission: StaffPermission) => boolean;
  recordSale: (sale: Sale) => void;
  clockOut: () => Promise<void>;
  signOut: () => Promise<void>;
  handleAuthError: (err: unknown) => boolean;
}

const DEFAULT_LOYALTY: LoyaltyConfig = { enabled: false, redemptionValue: 1, earnRate: 1 };

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ onSignedOut, children }: { onSignedOut: () => void; children: React.ReactNode }) {
  const [session, setSession] = useState<LoadedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);

  const signOut = useCallback(async () => {
    await clearSession();
    onSignedOut();
  }, [onSignedOut]);

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof StaffSessionExpiredError) {
        void signOut();
        return true;
      }
      return false;
    },
    [signOut]
  );

  const clockOut = useCallback(async () => {
    try {
      await staffApi.post("/staff-portal/clock-out");
    } catch (err) {
      if (!(err instanceof StaffSessionExpiredError)) throw err;
    }
    await signOut();
  }, [signOut]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await staffApi.get<MeResponse>("/staff-session/me");
      let shiftStart = await getShiftStart();
      if (!shiftStart) {
        shiftStart = new Date();
        await saveShiftStart(shiftStart.toISOString());
      }
      setSession({
        staff: data.staff,
        businessName: data.businessName ?? "",
        storeName: data.storeName ?? "",
        currency: data.currency ?? "USD",
        permissions: data.permissions ?? [],
        loyalty: data.loyalty ?? DEFAULT_LOYALTY,
        shiftStart,
      });
    } catch (err) {
      if (err instanceof StaffSessionExpiredError) {
        await signOut();
        return;
      }
      setError(err instanceof Error ? err.message : "Couldn't load your session.");
    }
  }, [signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<SessionValue | null>(() => {
    if (!session) return null;
    return {
      ...session,
      recentSales,
      can: (permission) => session.permissions.includes(permission),
      recordSale: (sale) => setRecentSales((prev) => [sale, ...prev]),
      clockOut,
      signOut,
      handleAuthError,
    };
  }, [session, recentSales, clockOut, signOut, handleAuthError]);

  if (!value) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.errorTitle}>Couldn't load your session</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <View style={styles.actions}>
              <Button label="Try again" onPress={load} />
              <Button label="Sign out" variant="ghost" onPress={signOut} />
            </View>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24 },
  errorTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 6 },
  errorMessage: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginBottom: 20 },
  actions: { gap: 8, alignSelf: "stretch" },
});