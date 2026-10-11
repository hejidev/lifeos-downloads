import React, { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { BarcodeScanningResult, BarcodeType, CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../context/SessionContext";
import { usePos } from "../context/PosContext";
import { Button, IconButton } from "../components/ui";
import { formatMoney } from "../lib/format";
import { haptics } from "../lib/feedback";
import { colors, radius } from "../theme";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Scan">;

const BARCODE_TYPES: BarcodeType[] = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "codabar", "qr"];
const REPEAT_DELAY_MS = 1500;
const RESULT_DURATION_MS = 2600;

interface ScanResult {
  type: "success" | "warning" | "error";
  title: string;
  detail: string;
}

export default function ScanScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { currency, handleAuthError } = useSession();
  const { findByBarcode, addProduct, getQuantity, itemCount, subtotal } = usePos();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);

  const busyRef = useRef(false);
  const lastRef = useRef({ code: "", time: 0 });
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resultTimer.current) clearTimeout(resultTimer.current);
    };
  }, []);

  const showResult = useCallback((next: ScanResult) => {
    if (resultTimer.current) clearTimeout(resultTimer.current);
    setResult(next);
    resultTimer.current = setTimeout(() => setResult(null), RESULT_DURATION_MS);
  }, []);

  const processCode = useCallback(
    async (raw: string, manual = false) => {
      const code = raw.trim();
      if (!code || busyRef.current) return;
      if (!manual && code === lastRef.current.code && Date.now() - lastRef.current.time < REPEAT_DELAY_MS) return;

      busyRef.current = true;
      try {
        const product = await findByBarcode(code);
        if (!product) {
          haptics.error();
          showResult({ type: "error", title: "Product not found", detail: code });
          return;
        }
        const outcome = addProduct(product);
        if (outcome === "added") {
          haptics.success();
          showResult({
            type: "success",
            title: `Added ${product.name}`,
            detail: `${formatMoney(product.price, currency)} · ${getQuantity(product.id)} in cart`,
          });
        } else if (outcome === "maxed") {
          haptics.error();
          showResult({ type: "warning", title: "Stock limit reached", detail: `Only ${product.stock} of ${product.name} available` });
        } else {
          haptics.error();
          showResult({ type: "error", title: `${product.name} is out of stock`, detail: code });
        }
      } catch (err) {
        if (handleAuthError(err)) return;
        haptics.error();
        showResult({
          type: "error",
          title: "Couldn't look that up",
          detail: err instanceof Error ? err.message : "Please try again.",
        });
      } finally {
        lastRef.current = { code, time: Date.now() };
        busyRef.current = false;
      }
    },
    [findByBarcode, addProduct, getQuantity, currency, handleAuthError, showResult]
  );

  function handleScanned({ data }: BarcodeScanningResult) {
    void processCode(data);
  }

  function submitManual() {
    const code = manualCode;
    setManualCode("");
    void processCode(code, true);
  }

  if (!permission) return <View style={styles.center} />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={40} color={colors.textFaint} />
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionText}>Allow camera access to scan product barcodes.</Text>
        <View style={styles.permissionActions}>
          {permission.canAskAgain ? (
            <Button label="Allow camera" onPress={requestPermission} />
          ) : (
            <Button label="Open settings" onPress={() => Linking.openSettings()} />
          )}
          <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  const tone = result?.type === "success" ? colors.success : result?.type === "warning" ? colors.warning : colors.danger;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {isFocused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={manualOpen ? undefined : handleScanned}
        />
      ) : null}

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <IconButton icon="chevron-back" translucent onPress={() => navigation.goBack()} />
          <Text style={styles.topTitle}>Scan items</Text>
          <IconButton icon={torch ? "flashlight" : "flashlight-outline"} translucent active={torch} onPress={() => setTorch((on) => !on)} />
        </View>

        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.frameHint}>Point the camera at a barcode</Text>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
          {result ? (
            <View style={[styles.resultCard, { borderColor: tone }]}>
              <Text style={[styles.resultTitle, { color: tone }]} numberOfLines={1}>{result.title}</Text>
              <Text style={styles.resultDetail} numberOfLines={2}>{result.detail}</Text>
            </View>
          ) : null}

          {manualOpen ? (
            <View style={styles.manualRow}>
              <TextInput
                style={styles.manualInput}
                placeholder="Type barcode"
                placeholderTextColor={colors.textFaint}
                value={manualCode}
                onChangeText={setManualCode}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={submitManual}
              />
              <Button label="Add" onPress={submitManual} disabled={!manualCode.trim()} />
              <IconButton icon="close" translucent onPress={() => setManualOpen(false)} />
            </View>
          ) : (
            <View style={styles.actions}>
              <Button label="Type code" icon="keypad-outline" variant="secondary" onPress={() => setManualOpen(true)} style={styles.actionSide} />
              <Button
                icon="receipt-outline"
                label={itemCount > 0 ? `Cart · ${itemCount} · ${formatMoney(subtotal, currency)}` : "Cart is empty"}
                onPress={() => navigation.navigate("Checkout")}
                disabled={itemCount === 0}
                style={styles.actionMain}
              />
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: 24, gap: 8 },
  permissionTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 8 },
  permissionText: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginBottom: 12 },
  permissionActions: { alignSelf: "stretch", gap: 8 },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  topTitle: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  frameWrap: { alignItems: "center", gap: 14 },
  frame: { width: 280, height: 190, borderRadius: radius.lg, borderWidth: 2, borderColor: "rgba(255,255,255,0.75)" },
  frameHint: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  bottom: { paddingHorizontal: 16, gap: 10 },
  resultCard: {
    backgroundColor: "rgba(11,15,26,0.92)",
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultTitle: { fontSize: 15, fontWeight: "700" },
  resultDetail: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  actions: { flexDirection: "row", gap: 10 },
  actionSide: { flex: 0 },
  actionMain: { flex: 1 },
  manualRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  manualInput: {
    flex: 1,
    backgroundColor: "rgba(11,15,26,0.92)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
});