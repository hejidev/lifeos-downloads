import React from "react";
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "../theme";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];
type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

const VARIANTS: Record<ButtonVariant, { background: string; border: string; text: string }> = {
  primary: { background: colors.primary, border: colors.primary, text: "#ffffff" },
  secondary: { background: colors.surfaceAlt, border: colors.border, text: colors.text },
  danger: { background: colors.dangerSoft, border: "rgba(248,113,113,0.35)", text: colors.danger },
  ghost: { background: "transparent", border: "transparent", text: colors.textMuted },
};

const TONES: Record<BadgeTone, { background: string; text: string }> = {
  neutral: { background: colors.surfaceAlt, text: colors.textMuted },
  primary: { background: colors.primarySoft, text: "#a5a8ff" },
  success: { background: colors.successSoft, text: colors.success },
  warning: { background: colors.warningSoft, text: colors.warning },
  danger: { background: colors.dangerSoft, text: colors.danger },
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = "primary", icon, loading = false, disabled = false, large = false, style }: ButtonProps) {
  const palette = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={inactive}
      style={[
        styles.button,
        large && styles.buttonLarge,
        { backgroundColor: palette.background, borderColor: palette.border },
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={large ? 20 : 17} color={palette.text} /> : null}
          <Text style={[styles.buttonLabel, large && styles.buttonLabelLarge, { color: palette.text }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  translucent?: boolean;
}

export function IconButton({ icon, onPress, active = false, disabled = false, translucent = false }: IconButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.iconButton,
        translucent && styles.iconButtonTranslucent,
        active && styles.iconButtonActive,
        disabled && styles.inactive,
      ]}
    >
      <Ionicons name={icon} size={20} color={active ? "#111827" : colors.text} />
    </TouchableOpacity>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const palette = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeLabel, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function EmptyState({ icon, title, message }: { icon: IconName; title: string; message?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={colors.textFaint} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
    </View>
  );
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerSide}>{onBack ? <IconButton icon="chevron-back" onPress={onBack} /> : null}</View>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.headerSide, styles.headerSideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  buttonLarge: { paddingVertical: 17, borderRadius: radius.lg },
  buttonLabel: { fontSize: 14, fontWeight: "600" },
  buttonLabelLarge: { fontSize: 16, fontWeight: "700" },
  inactive: { opacity: 0.45 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonTranslucent: { backgroundColor: "rgba(0,0,0,0.55)" },
  iconButtonActive: { backgroundColor: colors.warning },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: "flex-start" },
  badgeLabel: { fontSize: 11, fontWeight: "600" },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  empty: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 24, gap: 6 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "600", marginTop: 6 },
  emptyMessage: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerSide: { minWidth: 48, alignItems: "flex-start" },
  headerSideRight: { alignItems: "flex-end" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  headerSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});