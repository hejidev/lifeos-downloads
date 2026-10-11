import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { staffLogin } from "../api/client";
import { Button } from "../components/ui";
import { colors, radius } from "../theme";

const PIN_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [step, setStep] = useState<"identify" | "pin">("identify");
  const [storeCode, setStoreCode] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleContinue() {
    if (!storeCode.trim() || !name.trim()) return;
    setError(null);
    setStep("pin");
  }

  async function submit() {
    if (pin.length < MIN_PIN_LENGTH || loading) return;
    setLoading(true);
    setError(null);
    try {
      await staffLogin(storeCode.trim(), name.trim(), pin);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  function handlePinKey(key: string) {
    if (loading || key === "") return;
    if (key === "del") {
      setPin((current) => current.slice(0, -1));
      return;
    }
    setPin((current) => (current.length >= MAX_PIN_LENGTH ? current : current + key));
  }

  if (step === "identify") {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Staff Terminal</Text>
          <Text style={styles.subtitle}>Enter your store code and name</Text>
          <TextInput
            style={styles.input}
            placeholder="Store code"
            placeholderTextColor={colors.textFaint}
            value={storeCode}
            onChangeText={(text) => setStoreCode(text.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
          />
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.textFaint}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
          <Button label="Continue" onPress={handleContinue} disabled={!storeCode.trim() || !name.trim()} large />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter PIN</Text>
      <Text style={styles.subtitle}>for {name}</Text>
      <View style={styles.dotsRow}>
        {Array.from({ length: Math.max(MIN_PIN_LENGTH, pin.length) }).map((_, index) => (
          <View key={index} style={[styles.dot, index < pin.length && styles.dotFilled]} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : <View style={styles.errorSpacer} />}
      <View style={styles.pinGrid}>
        {PIN_KEYS.map((key, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.pinKey, key === "" && styles.pinKeyHidden]}
            onPress={() => handlePinKey(key)}
            disabled={loading || key === ""}
          >
            <Text style={styles.pinKeyText}>{key === "del" ? "⌫" : key}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Button
        label="Sign in"
        onPress={submit}
        loading={loading}
        disabled={pin.length < MIN_PIN_LENGTH}
        large
        style={styles.signIn}
      />
      <TouchableOpacity
        onPress={() => {
          setStep("identify");
          setPin("");
          setError(null);
        }}
      >
        <Text style={styles.link}>← Not {name}?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, textAlign: "center" },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: 4, marginBottom: 28 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
    textAlign: "center",
  },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.border },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  error: { color: colors.danger, textAlign: "center", fontSize: 13, minHeight: 32, marginBottom: 8 },
  errorSpacer: { minHeight: 32, marginBottom: 8 },
  pinGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginBottom: 20 },
  pinKey: { width: 76, height: 66, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  pinKeyHidden: { backgroundColor: "transparent" },
  pinKeyText: { color: colors.text, fontSize: 22, fontWeight: "600" },
  signIn: { marginHorizontal: 8 },
  link: { color: colors.textFaint, textAlign: "center", marginTop: 20, fontSize: 13 },
});