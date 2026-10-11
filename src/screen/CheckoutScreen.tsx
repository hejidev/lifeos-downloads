import React, { useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NetworkError, staffApi } from "../api/client";
import { useSession } from "../context/SessionContext";
import { usePos } from "../context/PosContext";
import { Badge, Button, Card, EmptyState, IconButton, ScreenHeader, SectionLabel } from "../components/ui";
import type { IconName } from "../components/ui";
import { CustomerPicker } from "../components/CustomerPicker";
import { formatMoney } from "../lib/format";
import { haptics } from "../lib/feedback";
import { colors, radius } from "../theme";
import type { RootStackParamList } from "../navigation/types";
import type { Customer, PaymentMethod, Sale } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Checkout">;

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: IconName }[] = [
  { value: "CASH", label: "Cash", icon: "cash-outline" },
  { value: "CARD", label: "Card", icon: "card-outline" },
  { value: "TRANSFER", label: "Transfer", icon: "swap-horizontal-outline" },
  { value: "MOBILE_MONEY", label: "Mobile", icon: "phone-portrait-outline" },
];

export default function CheckoutScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { currency, loyalty, can, recordSale, handleAuthError } = useSession();
  const { cart, customers, subtotal, itemCount, setQuantity, removeLine, clearCart, refreshCatalog, addCustomer } = usePos();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [redeemText, setRedeemText] = useState("");
  const [cashText, setCashText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const redemptionValue = loyalty.redemptionValue;
  const maxRedeemable = useMemo(() => {
    if (!customer || !loyalty.enabled || redemptionValue <= 0) return 0;
    return Math.min(customer.loyaltyPoints, Math.ceil(subtotal / redemptionValue));
  }, [customer, loyalty.enabled, redemptionValue, subtotal]);

  const redeem = Math.min(parseInt(redeemText, 10) || 0, maxRedeemable);
  const discount = Math.min(subtotal, redeem * redemptionValue);
  const total = Math.max(0, subtotal - discount);
  const pointsEarned = customer && loyalty.enabled ? Math.floor(total / 100) * loyalty.earnRate : 0;
  const cashReceived = parseFloat(cashText) || 0;
  const change = cashReceived - total;

  function handleRedeemChange(text: string) {
    const digits = text.replace(/\D/g, "");
    if (!digits) {
      setRedeemText("");
      return;
    }
    setRedeemText(String(Math.min(parseInt(digits, 10), maxRedeemable)));
  }

  function handleSelectCustomer(selected: Customer | null) {
    setCustomer(selected);
    setRedeemText("");
    setPickerOpen(false);
  }

  function handleCustomerCreated(created: Customer) {
    addCustomer(created);
    handleSelectCustomer(created);
  }

  function confirmRemove(productId: string, name: string) {
    Alert.alert("Remove item?", name, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeLine(productId) },
    ]);
  }

  async function handleCharge() {
    if (cart.length === 0 || submittingRef.current) return;
    if (!can("CREATE_SALE")) {
      setError("Your role can't ring up sales.");
      return;
    }
    if (paymentMethod === "CASH" && cashText && cashReceived < total) {
      setError("Cash received is less than the total.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const { sale } = await staffApi.post<{ sale: Sale }>("/staff-pos/sales", {
        customerId: customer?.id,
        items: cart.map((line) => ({
          productId: line.productId,
          name: line.name,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
        })),
        paymentMethod,
        status: "PAID",
        redeemPoints: redeem > 0 ? redeem : undefined,
      });
      recordSale(sale);
      clearCart();
      void refreshCatalog();
      haptics.success();
      navigation.replace("Receipt", {
        sale,
        cashReceived: paymentMethod === "CASH" && cashReceived > 0 ? cashReceived : undefined,
      });
    } catch (err) {
      if (handleAuthError(err)) return;
      haptics.error();
      if (err instanceof NetworkError) {
        setError(
          "The connection dropped while charging. This sale may have gone through. Check your receipts and activity on the shift screen before charging again."
        );
      } else {
        setError(err instanceof Error ? err.message : "Couldn't complete the sale.");
        void refreshCatalog();
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Review sale"
        subtitle={`${itemCount} item${itemCount === 1 ? "" : "s"}`}
        onBack={() => navigation.goBack()}
      />

      {cart.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState icon="cart-outline" title="Your cart is empty" message="Add items by scanning or searching the catalog." />
          <Button label="Back to products" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: 140 + insets.bottom }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View>
              <SectionLabel>Items</SectionLabel>
              <Card style={styles.listCard}>
                {cart.map((line, index) => (
                  <View key={line.productId} style={[styles.line, index > 0 && styles.lineBorder]}>
                    <View style={styles.lineBody}>
                      <Text style={styles.lineName} numberOfLines={2}>{line.name}</Text>
                      <Text style={styles.lineMeta}>
                        {formatMoney(line.unitPrice, currency)} each
                        {line.quantity >= line.stock ? " · max available" : ""}
                      </Text>
                    </View>
                    <View style={styles.stepper}>
                      <TouchableOpacity style={styles.stepButton} onPress={() => setQuantity(line.productId, line.quantity - 1)}>
                        <Ionicons name="remove" size={18} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.stepValue}>{line.quantity}</Text>
                      <TouchableOpacity
                        style={[styles.stepButton, line.quantity >= line.stock && styles.stepDisabled]}
                        disabled={line.quantity >= line.stock}
                        onPress={() => setQuantity(line.productId, line.quantity + 1)}
                      >
                        <Ionicons name="add" size={18} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.lineEnd}>
                      <Text style={styles.lineTotal}>{formatMoney(line.unitPrice * line.quantity, currency)}</Text>
                      <TouchableOpacity onPress={() => confirmRemove(line.productId, line.name)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </Card>
            </View>

            <View>
              <SectionLabel>Customer</SectionLabel>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setPickerOpen(true)}>
                <Card style={styles.customerCard}>
                  <Ionicons name="person-outline" size={20} color={colors.textMuted} />
                  <View style={styles.lineBody}>
                    <Text style={styles.lineName}>{customer ? customer.name : "Walk-in customer"}</Text>
                    {customer ? (
                      <Text style={styles.lineMeta}>{customer.phone ?? "No phone on file"}</Text>
                    ) : (
                      <Text style={styles.lineMeta}>Tap to attach a customer</Text>
                    )}
                  </View>
                  {customer && customer.loyaltyPoints > 0 ? <Badge label={`${customer.loyaltyPoints} pts`} tone="success" /> : null}
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </Card>
              </TouchableOpacity>
            </View>

            {maxRedeemable > 0 ? (
              <View>
                <SectionLabel>Loyalty points</SectionLabel>
                <Card style={styles.redeemCard}>
                  <View style={styles.redeemRow}>
                    <TextInput
                      style={styles.redeemInput}
                      placeholder="0"
                      placeholderTextColor={colors.textFaint}
                      value={redeemText}
                      onChangeText={handleRedeemChange}
                      keyboardType="number-pad"
                    />
                    <Button label="Use max" variant="secondary" onPress={() => setRedeemText(String(maxRedeemable))} />
                  </View>
                  <Text style={styles.lineMeta}>
                    {redeem > 0
                      ? `${redeem} points = ${formatMoney(discount, currency)} off`
                      : `Up to ${maxRedeemable} points can be applied · each point is worth ${formatMoney(redemptionValue, currency)}`}
                  </Text>
                </Card>
              </View>
            ) : null}

            <View>
              <SectionLabel>Payment</SectionLabel>
              <View style={styles.paymentRow}>
                {PAYMENT_OPTIONS.map((option) => {
                  const active = option.value === paymentMethod;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      activeOpacity={0.8}
                      onPress={() => setPaymentMethod(option.value)}
                      style={[styles.payment, active && styles.paymentActive]}
                    >
                      <Ionicons name={option.icon} size={20} color={active ? "#a5a8ff" : colors.textMuted} />
                      <Text style={[styles.paymentLabel, active && styles.paymentLabelActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {paymentMethod === "CASH" ? (
                <Card style={styles.cashCard}>
                  <View style={styles.redeemRow}>
                    <TextInput
                      style={styles.redeemInput}
                      placeholder="Cash received"
                      placeholderTextColor={colors.textFaint}
                      value={cashText}
                      onChangeText={(text) => setCashText(text.replace(/[^0-9.]/g, ""))}
                      keyboardType="decimal-pad"
                    />
                    <Button label="Exact" variant="secondary" onPress={() => setCashText(String(total))} />
                  </View>
                  {cashText ? (
                    <Text style={[styles.changeText, change < 0 && styles.changeShort]}>
                      {change >= 0 ? `Change due ${formatMoney(change, currency)}` : `Short by ${formatMoney(Math.abs(change), currency)}`}
                    </Text>
                  ) : null}
                </Card>
              ) : null}
            </View>

            <Card style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatMoney(subtotal, currency)}</Text>
              </View>
              {discount > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Loyalty discount</Text>
                  <Text style={[styles.totalValue, { color: colors.success }]}>-{formatMoney(discount, currency)}</Text>
                </View>
              ) : null}
              {pointsEarned > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Points earned</Text>
                  <Text style={styles.totalValue}>+{pointsEarned}</Text>
                </View>
              ) : null}
              <View style={[styles.totalRow, styles.grandRow]}>
                <Text style={styles.grandLabel}>Total</Text>
                <Text style={styles.grandValue}>{formatMoney(total, currency)}</Text>
              </View>
            </Card>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {cart.length > 0 ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            large
            icon="lock-closed-outline"
            label={`Charge ${formatMoney(total, currency)}`}
            onPress={handleCharge}
            loading={submitting}
          />
        </View>
      ) : null}

      <CustomerPicker
        visible={pickerOpen}
        customers={customers}
        selectedId={customer?.id ?? null}
        canCreate={can("CREATE_CUSTOMER")}
        onSelect={handleSelectCustomer}
        onCreated={handleCustomerCreated}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  emptyWrap: { flex: 1, justifyContent: "center", padding: 24, gap: 8 },
  content: { padding: 16, gap: 20 },
  listCard: { paddingVertical: 4, paddingHorizontal: 14 },
  line: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  lineBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  lineBody: { flex: 1 },
  lineName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  lineMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  stepDisabled: { opacity: 0.35 },
  stepValue: { color: colors.text, fontSize: 15, fontWeight: "700", minWidth: 22, textAlign: "center" },
  lineEnd: { alignItems: "flex-end", gap: 8, minWidth: 74 },
  lineTotal: { color: colors.text, fontSize: 13, fontWeight: "700" },
  customerCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  redeemCard: { gap: 10 },
  cashCard: { marginTop: 10, gap: 10 },
  redeemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  redeemInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  changeText: { color: colors.success, fontSize: 13, fontWeight: "600" },
  changeShort: { color: colors.warning },
  paymentRow: { flexDirection: "row", gap: 8 },
  payment: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  paymentLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  paymentLabelActive: { color: "#a5a8ff" },
  totals: { gap: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: colors.textMuted, fontSize: 13 },
  totalValue: { color: colors.text, fontSize: 13, fontWeight: "600" },
  grandRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 2 },
  grandLabel: { color: colors.text, fontSize: 16, fontWeight: "700" },
  grandValue: { color: colors.text, fontSize: 22, fontWeight: "800" },
  errorBox: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
  },
  errorText: { color: colors.danger, fontSize: 13, flex: 1, lineHeight: 18 },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});