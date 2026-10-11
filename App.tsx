import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getToken } from "./src/api/client";
import { SessionProvider } from "./src/context/SessionContext";
import { PosProvider } from "./src/context/PosContext";
import LoginScreen from "./src/screen/LoginScreen";
import ShiftScreen from "./src/screen/ShiftScreen";
import SaleScreen from "./src/screen/SaleScreen";
import ScanScreen from "./src/screen/ScanScreen";
import CheckoutScreen from "./src/screen/CheckoutScreen";
import ReceiptScreen from "./src/screen/ReceiptScreen";
import { colors } from "./src/theme";
import type { RootStackParamList } from "./src/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.primary,
    text: colors.text,
  },
};

export default function App() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    getToken().then((token) => {
      setLoggedIn(!!token);
      setChecking(false);
    });
  }, []);

  const handleSignedOut = useCallback(() => setLoggedIn(false), []);

  let content: React.ReactNode;

  if (checking) {
    content = (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (!loggedIn) {
    content = <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;
  } else {
    content = (
      <SessionProvider onSignedOut={handleSignedOut}>
        <PosProvider>
          <NavigationContainer theme={navigationTheme}>
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="Shift" component={ShiftScreen} />
              <Stack.Screen name="Sale" component={SaleScreen} />
              <Stack.Screen name="Scan" component={ScanScreen} />
              <Stack.Screen name="Checkout" component={CheckoutScreen} />
              <Stack.Screen name="Receipt" component={ReceiptScreen} options={{ gestureEnabled: false }} />
            </Stack.Navigator>
          </NavigationContainer>
        </PosProvider>
      </SessionProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {content}
    </SafeAreaProvider>
  );
}