import React, { useEffect, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { staffApi } from "../api/client";
import { useSession } from "../context/SessionContext";
import { Badge, Button, IconButton } from "./ui";
import { colors, radius } from "../theme";
import type { Customer } from "../types";

interface Props {
  visible: boolean;
  customers: Customer[];
  selectedId: string | null;
  canCreate: boolean;
  onSelect: (customer: Customer | null) => void;
  onCreated: (customer: Customer) => void;
  onClose: () => void;
}

export function CustomerPicker({ visible, customers, selectedId, canCreate, onSelect, onCreated, onClose }: Props) {
  const { handleAuthError } = useSession();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"list" | "create">("list");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setMode("list");
      setName("");
      setPhone("");
      setError(null);
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (customer) => customer.name.toLowerCase().includes(q) || (customer.phone ?? "").includes(q)
    );
  }, [customers, query]);

  async function handleCreate() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { customer } = await staffApi.post<{ customer: Customer }>("/staff-pos/customers", {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      onCreated(customer);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err instanceof Error ? err.message : "Couldn't save this customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>{mode === "create" ? "New customer" : "Select customer"}</Text>
          <IconButton icon="close" onPress={onClose} />
        </View>

        {mode === "create" ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Customer name"
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Phone (optional)"
              placeholderTextColor={colors.textFaint}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Save customer" onPress={handleCreate} loading={saving} disabled={!name.trim()} />
            <Button label="Back to list" variant="ghost" onPress={() => setMode("list")} />
          </View>
        ) : (
          <>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color={colors.textFaint} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or phone"
                placeholderTextColor={colors.textFaint}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(customer) => customer.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                <TouchableOpacity style={[styles.row, selectedId === null && styles.rowSelected]} onPress={() => onSelect(null)}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName}>Walk-in customer</Text>
                    <Text style={styles.rowMeta}>No customer attached</Text>
                  </View>
                </TouchableOpacity>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.row, selectedId === item.id && styles.rowSelected]}
                  onPress={() => onSelect(item)}
                >
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowMeta}>{item.phone ?? "No phone on file"}</Text>
                  </View>
                  {item.loyaltyPoints > 0 ? <Badge label={`${item.loyaltyPoints} pts`} tone="success" /> : null}
                </TouchableOpacity>
              )}
            />
            {canCreate ? (
              <View style={styles.footer}>
                <Button label="New customer" icon="person-add-outline" variant="secondary" onPress={() => setMode("create")} />
              </View>
            ) : null}
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  form: { padding: 16, gap: 12 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 15,
  },
  error: { color: colors.danger, fontSize: 13 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rowBody: { flex: 1 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
});