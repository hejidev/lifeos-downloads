import React, { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { staffApi } from "../api/client";
import { useSession } from "../context/SessionContext";
import { usePos } from "../context/PosContext";
import { Badge, Button, Card, SectionLabel } from "../components/ui";
import type { IconName } from "../components/ui";
import { Toast, useToast } from "../components/Toast";
import { formatClock, formatDay, formatDuration, formatMoney } from "../lib/format";
import { colors, radius } from "../theme";
import type { RootStackParamList } from "../navigation/types";
import type { ActivityItem, MyShift, TeamMember } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Shift">;

const QUICK_ACTIONS: { action: string; label: string; icon: IconName }[] = [
  { action: "CUSTOMER_ADDED", label: "Helped a customer", icon: "people-outline" },
  { action: "REFUND_ISSUED", label: "Processed a return", icon: "return-down-back-outline" },
  { action: "OTHER", label: "Add a note", icon: "create-outline" },
];

function ShiftTimer({ since }: { since: Date }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <Text style={styles.timerValue}>{formatDuration(now - since.getTime())}</Text>;
}

export default function ShiftScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { staff, businessName, storeName, currency, shiftStart, recentSales, can, clockOut, handleAuthError } = useSession();
  const { itemCount } = usePos();
  const { toast, show } = useToast();

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [shifts, setShifts] = useState<MyShift[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const loadDashboard = useCallback(async () => {
    const results = await Promise.allSettled([
      staffApi.get<{ activity: ActivityItem[] }>("/staff-portal/activity"),
      staffApi.get<{ team: TeamMember[] }>("/staff-portal/team"),
      staffApi.get<{ shifts: MyShift[] }>("/my-shifts"),
    ]);
    for (const result of results) {
      if (result.status === "rejected" && handleAuthError(result.reason)) return;
    }
    const [activityResult, teamResult, shiftsResult] = results;
    if (activityResult.status === "fulfilled") setActivity(activityResult.value.activity);
    if (teamResult.status === "fulfilled") setTeam(teamResult.value.team);
    if (shiftsResult.status === "fulfilled") setShifts(shiftsResult.value.shifts);
  }, [handleAuthError]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }

  function confirmClockOut() {
    const elapsed = formatDuration(Date.now() - shiftStart.getTime());
    Alert.alert("End your shift?", `You've been on shift for ${elapsed}. You'll need to sign in again to start a new one.`, [
      { text: "Stay clocked in", style: "cancel" },
      {
        text: "Clock out",
        style: "destructive",
        onPress: async () => {
          setClockingOut(true);
          try {
            await clockOut();
          } catch (err) {
            setClockingOut(false);
            Alert.alert("Couldn't clock out", err instanceof Error ? err.message : "Please try again.");
          }
        },
      },
    ]);
  }

  async function logActivity(action: string, description: string) {
    try {
      await staffApi.post("/staff-portal/activity", { action, description });
      show("success", `Logged: ${description}`);
      void loadDashboard();
      return true;
    } catch (err) {
      if (!handleAuthError(err)) show("error", err instanceof Error ? err.message : "Couldn't log that.");
      return false;
    }
  }

  function handleQuickAction(action: string, label: string) {
    if (action === "OTHER") {
      setNoteOpen(true);
      return;
    }
    void logActivity(action, label);
  }

  async function saveNote() {
    if (!note.trim() || savingNote) return;
    setSavingNote(true);
    const saved = await logActivity("OTHER", note.trim());
    setSavingNote(false);
    if (saved) {
      setNote("");
      setNoteOpen(false);
    }
  }

  const canSell = can("CREATE_SALE");
  const revenue = recentSales.reduce((sum, sale) => sum + sale.total, 0);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>You're on shift, {staff.name}</Text>
          <Text style={styles.subtext}>
            {[businessName, storeName, staff.role.replace("_", " ")].filter(Boolean).join(" · ")}
          </Text>
        </View>

        <Card style={styles.timerCard}>
          <Text style={styles.timerLabel}>Shift duration</Text>
          <ShiftTimer since={shiftStart} />
          <Button label="Clock out" variant="danger" icon="log-out-outline" onPress={confirmClockOut} loading={clockingOut} />
        </Card>

        {canSell ? (
          <Button
            large
            icon="cart-outline"
            label={itemCount > 0 ? `Resume sale · ${itemCount} item${itemCount === 1 ? "" : "s"}` : "New sale"}
            onPress={() => navigation.navigate("Sale")}
            style={styles.saleButton}
          />
        ) : (
          <Card style={styles.disabledCard}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
            <Text style={styles.disabledText}>Sales access isn't enabled for your role.</Text>
          </Card>
        )}

        <View style={styles.statsRow}>
          <Card style={styles.stat}>
            <Text style={styles.statValue}>{recentSales.length}</Text>
            <Text style={styles.statLabel}>Sales</Text>
          </Card>
          <Card style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(revenue, currency)}
            </Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </Card>
          <Card style={styles.stat}>
            <Text style={styles.statValue}>{activity.length}</Text>
            <Text style={styles.statLabel}>Actions</Text>
          </Card>
        </View>

        {shifts.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel>Your upcoming shifts</SectionLabel>
            <Card style={styles.listCard}>
              {shifts.slice(0, 4).map((shift, index) => {
                const start = new Date(shift.startsAt);
                const end = new Date(shift.endsAt);
                const isToday = formatDay(start) === "Today";
                return (
                  <View key={shift.id} style={[styles.listRow, index > 0 && styles.listRowBorder]}>
                    <View style={styles.listBody}>
                      <Text style={styles.listTitle}>{formatDay(start)}</Text>
                      <Text style={styles.listMeta}>
                        {formatClock(start)} – {formatClock(end)}
                        {shift.storeName ? ` · ${shift.storeName}` : ""}
                      </Text>
                    </View>
                    {isToday ? <Badge label="Today" tone="primary" /> : null}
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}

        {team.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel>On shift with you</SectionLabel>
            <View style={styles.chips}>
              {team.map((member) => (
                <View key={member.id} style={styles.chip}>
                  <View style={styles.chipDot} />
                  <Text style={styles.chipName}>{member.name}</Text>
                  <Text style={styles.chipRole}>{member.role.replace("_", " ")}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionLabel>Quick log</SectionLabel>
          <View style={styles.quickRow}>
            {QUICK_ACTIONS.map((quick) => (
              <TouchableOpacity
                key={quick.action}
                style={styles.quick}
                activeOpacity={0.75}
                onPress={() => handleQuickAction(quick.action, quick.label)}
              >
                <Ionicons name={quick.icon} size={22} color={colors.primary} />
                <Text style={styles.quickLabel}>{quick.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {recentSales.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel>Your receipts this shift</SectionLabel>
            <Card style={styles.listCard}>
              {recentSales.slice(0, 5).map((sale, index) => (
                <TouchableOpacity
                  key={sale.id}
                  style={[styles.listRow, index > 0 && styles.listRowBorder]}
                  onPress={() => navigation.navigate("Receipt", { sale })}
                >
                  <View style={styles.listBody}>
                    <Text style={styles.listTitle} numberOfLines={1}>{sale.receiptNumber}</Text>
                    <Text style={styles.listMeta}>{formatClock(new Date(sale.createdAt))}</Text>
                  </View>
                  <Text style={styles.listAmount}>{formatMoney(sale.total, currency)}</Text>
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionLabel>Today's activity</SectionLabel>
          <Card style={styles.listCard}>
            {activity.length === 0 ? (
              <Text style={styles.emptyText}>Nothing logged yet. Ring up a sale or use quick log.</Text>
            ) : (
              activity.slice(0, 8).map((entry, index) => (
                <View key={entry.id} style={[styles.listRow, index > 0 && styles.listRowBorder]}>
                  <Text style={[styles.listTitle, styles.activityText]} numberOfLines={2}>{entry.description}</Text>
                  <Text style={styles.listMeta}>{formatClock(new Date(entry.createdAt))}</Text>
                </View>
              ))
            )}
          </Card>
        </View>
      </ScrollView>

      <Toast toast={toast} />

      <Modal visible={noteOpen} transparent animationType="fade" onRequestClose={() => setNoteOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a note</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="What happened?"
              placeholderTextColor={colors.textFaint}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={300}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button label="Cancel" variant="ghost" onPress={() => setNoteOpen(false)} />
              <Button label="Log note" onPress={saveNote} loading={savingNote} disabled={!note.trim()} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, gap: 18 },
  header: { alignItems: "center", gap: 4 },
  greeting: { color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  subtext: { color: colors.textMuted, fontSize: 12, textAlign: "center" },
  timerCard: { alignItems: "center", gap: 6 },
  timerLabel: { color: colors.textMuted, fontSize: 12 },
  timerValue: { color: colors.text, fontSize: 34, fontWeight: "700", fontVariant: ["tabular-nums"], marginBottom: 8 },
  saleButton: { paddingVertical: 20 },
  disabledCard: { flexDirection: "row", alignItems: "center", gap: 10, borderStyle: "dashed" },
  disabledText: { color: colors.textMuted, fontSize: 13, flex: 1 },
  statsRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 8 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  section: { gap: 0 },
  listCard: { paddingVertical: 4, paddingHorizontal: 14 },
  listRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, gap: 10 },
  listRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  listBody: { flex: 1 },
  listTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  activityText: { flex: 1, fontWeight: "400" },
  listMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  listAmount: { color: colors.text, fontSize: 13, fontWeight: "600" },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  chipName: { color: colors.text, fontSize: 12, fontWeight: "600" },
  chipRole: { color: colors.textMuted, fontSize: 10 },
  quickRow: { flexDirection: "row", gap: 10 },
  quick: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickLabel: { color: colors.text, fontSize: 11, fontWeight: "600", textAlign: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, gap: 12, borderWidth: 1, borderColor: colors.border },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  noteInput: {
    minHeight: 96,
    textAlignVertical: "top",
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.text,
    fontSize: 14,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});