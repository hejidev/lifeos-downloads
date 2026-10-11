import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "../theme";

export type ToastType = "success" | "error";

export interface ToastState {
  type: ToastType;
  message: string;
}

export function useToast(duration = 2400) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (type: ToastType, message: string) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ type, message });
      timer.current = setTimeout(() => setToast(null), duration);
    },
    [duration]
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { toast, show };
}

export function Toast({ toast }: { toast: ToastState | null }) {
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  const success = toast.type === "success";
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 90 }]}>
      <View style={[styles.toast, { backgroundColor: success ? colors.success : colors.danger }]}>
        <Ionicons name={success ? "checkmark-circle" : "alert-circle"} size={18} color="#0B0F1A" />
        <Text style={styles.message}>{toast.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    maxWidth: "100%",
  },
  message: { color: "#0B0F1A", fontSize: 13, fontWeight: "700", flexShrink: 1 },
});