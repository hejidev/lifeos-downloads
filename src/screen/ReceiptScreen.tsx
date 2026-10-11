import React, { useCallback } from "react";
import { BackHandler, Platform, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../context/SessionContext";
import { Button, Card } from "../components/ui";
import { formatDateTime, formatMoney } from "../lib/format";
import { colors } from "../theme";
import type { RootStackParamList } from "../navigation/types";
import type { PaymentMethod, Sale } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Receipt">;

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  TRANSFER: "Transfer",
  MOBILE_MONEY: "Mobile money",
};

interface ReceiptDetails {
  sale: Sale;
  businessName: string;
  storeName: string;
  currency: string;
  staffName: string;
  cashReceived?: number;
  pointsEarned: number;
}

function buildReceiptText({ sale, businessName, storeName, currency, staffName, cashReceived, pointsEarned }: ReceiptDetails) {
  const width = 36;
  const line = (left: string, right: string) => `${left}${" ".repeat(Math.max(1, width - left.length - right.length))}${right}`;
  const divider = "-".repeat(width);

  return [
    businessName,
    ...(storeName ? [storeName] : []),
    `Receipt ${sale.receiptNumber}`,
    formatDateTime(sale.createdAt),
    `Customer: ${sale.customerName ?? "Walk-in"}`,
    divider,
    ...sale.items.flatMap((item) => [
      item.name,
      line(`  ${item.quantity} x ${formatMoney(item.unitPrice, currency)}`, formatMoney(item.lineTotal, currency)),
    ]),
    divider,
    line("Subtotal", formatMoney(sale.subtotal, currency)),
    ...(sale.discount > 0 ? [line("Discount", `-${formatMoney(sale.discount, currency)}`)] : []),
    line("Total", formatMoney(sale.total, currency)),
    "",
    `Payment: ${PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}`,
    ...(cashReceived !== undefined
      ? [line("Cash received", formatMoney(cashReceived, currency)), line("Change", formatMoney(Math.max(0, cashReceived - sale.total), currency))]
      : []),
    ...(pointsEarned > 0 ? [`Points earned: ${pointsEarned}`] : []),
    `Served by: ${staffName}`,
    "",
    "Thank you for your business!",
  ].join("\n");
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowStrong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong]}>{value}</Text>
    </View>
  );
}

export default function ReceiptScreen({ navigation, route }: Props) {
  const { sale, cashReceived } = route.params;
  const insets = useSafeAreaInsets();
  const { businessName, storeName, currency, staff, loyalty } = useSession();

  const pointsEarned = sale.customerName && loyalty.enabled ? Math.floor(sale.total / 100) * loyalty.earnRate : 0;

  const goToShift = useCallback(() => navigation.reset({ index: 0, routes: [{ name: "Shift" }] }), [navigation]);
  const startNewSale = useCallback(
    () => navigation.reset({ index: 1, routes: [{ name: "Shift" }, { name: "Sale" }] }),
    [navigation]
  );

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        goToShift();
        return true;
      });
      return () => subscription.remove();
    }, [goToShift])
  );

  async function handleShare() {
    try {
      await Share.share({
        title: `Receipt ${sale.receiptNumber}`,
        message: buildReceiptText({ sale, businessName, storeName, currency, staffName: staff.name, cashReceived, pointsEarned }),
      });
    } catch {
      return;
    }
  }

  const change = cashReceived !== undefined ? Math.max(0, cashReceived - sale.total) : 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.success}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={30} color="#0B0F1A" />
          </View>
          <Text style={styles.successTitle}>Payment received</Text>
          <Text style={styles.successAmount}>{formatMoney(sale.total, currency)}</Text>
          {cashReceived !== undefined ? <Text style={styles.changeDue}>Change due {formatMoney(change, currency)}</Text> : null}
        </View>

        <Card style={styles.receipt}>
          <Text style={styles.business}>{businessName}</Text>
          {storeName ? <Text style={styles.meta}>{storeName}</Text> : null}
          <Text style={styles.meta}>{sale.receiptNumber}</Text>
          <Text style={styles.meta}>{formatDateTime(sale.createdAt)}</Text>
          <Text style={styles.meta}>{sale.customerName ?? "Walk-in customer"}</Text>

          <View style={styles.divider} />
          {sale.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.itemMeta}>{item.quantity} × {formatMoney(item.unitPrice, currency)}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatMoney(item.lineTotal, currency)}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <Row label="Subtotal" value={formatMoney(sale.subtotal, currency)} />
          {sale.discount > 0 ? <Row label="Discount" value={`-${formatMoney(sale.discount, currency)}`} /> : null}
          <Row label="Total" value={formatMoney(sale.total, currency)} strong />

          <View style={styles.divider} />
          <Row label="Payment" value={PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod} />
          {cashReceived !== undefined ? <Row label="Cash received" value={formatMoney(cashReceived, currency)} /> : null}
          {pointsEarned > 0 ? <Row label="Points earned" value={`+${pointsEarned}`} /> : null}
          <Row label="Served by" value={staff.name} />
        </Card>

        <View style={styles.actions}>
          <Button label="Share receipt" icon="share-outline" variant="secondary" onPress={handleShare} />
          <Button label="New sale" icon="cart-outline" large onPress={startNewSale} />
          <Button label="Back to shift" variant="ghost" onPress={goToShift} />
        </View>
      </ScrollView>
    </View>
  );
}

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, gap: 20 },
  success: { alignItems: "center", gap: 6 },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  successTitle: { color: colors.success, fontSize: 15, fontWeight: "700" },
  successAmount: { color: colors.text, fontSize: 32, fontWeight: "800" },
  changeDue: { color: colors.warning, fontSize: 14, fontWeight: "600" },
  receipt: { gap: 4, padding: 20 },
  business: { color: colors.text, fontSize: 17, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  meta: { color: colors.textMuted, fontSize: 12, textAlign: "center", fontFamily: MONO },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  item: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 4 },
  itemBody: { flex: 1 },
  itemName: { color: colors.text, fontSize: 13 },
  itemMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontFamily: MONO },
  itemTotal: { color: colors.text, fontSize: 13, fontFamily: MONO },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  rowLabel: { color: colors.textMuted, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13, fontFamily: MONO },
  rowStrong: { color: colors.text, fontSize: 16, fontWeight: "700" },
  actions: { gap: 10 },
});