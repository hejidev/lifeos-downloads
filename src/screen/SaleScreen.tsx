import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "../context/SessionContext";
import { usePos } from "../context/PosContext";
import { Button, EmptyState, IconButton, ScreenHeader } from "../components/ui";
import { Toast, useToast } from "../components/Toast";
import { formatMoney } from "../lib/format";
import { haptics } from "../lib/feedback";
import { colors, radius } from "../theme";
import type { RootStackParamList } from "../navigation/types";
import type { Product } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Sale">;

interface ProductRowProps {
  product: Product;
  quantity: number;
  currency: string;
  onAdd: (product: Product) => void;
}

const ProductRow = React.memo(function ProductRow({ product, quantity, currency, onAdd }: ProductRowProps) {
  const outOfStock = product.stock <= 0;
  const low = !outOfStock && product.stock <= product.lowStockAt;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={outOfStock}
      onPress={() => onAdd(product)}
      style={[styles.row, outOfStock && styles.rowDisabled]}
    >
      <View style={styles.thumb}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.thumbImage} />
        ) : (
          <Ionicons name="cube-outline" size={20} color={colors.textFaint} />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.rowPrice}>{formatMoney(product.price, currency)}</Text>
        <Text style={[styles.rowStock, low && styles.rowStockLow, outOfStock && styles.rowStockOut]}>
          {outOfStock ? "Out of stock" : `${product.stock} in stock`}
        </Text>
      </View>
      {quantity > 0 ? (
        <View style={styles.qtyBadge}>
          <Text style={styles.qtyBadgeText}>{quantity}</Text>
        </View>
      ) : (
        <View style={styles.addButton}>
          <Ionicons name="add" size={20} color="#ffffff" />
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function SaleScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { currency } = useSession();
  const { products, loadingCatalog, catalogError, refreshCatalog, cart, itemCount, subtotal, addProduct, clearCart } = usePos();
  const { toast, show } = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const categories = useMemo(() => {
    const names = new Set<string>();
    products.forEach((product) => {
      if (product.category) names.add(product.category);
    });
    return [...names].sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category && product.category !== category) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        (product.sku ?? "").toLowerCase().includes(q) ||
        (product.barcode ?? "").includes(q)
      );
    });
  }, [products, query, category]);

  const quantities = useMemo(() => new Map(cart.map((line) => [line.productId, line.quantity])), [cart]);

  const handleAdd = useCallback(
    (product: Product) => {
      const result = addProduct(product);
      if (result === "added") {
        haptics.light();
        return;
      }
      haptics.error();
      show("error", result === "out_of_stock" ? `${product.name} is out of stock` : `Only ${product.stock} of ${product.name} in stock`);
    },
    [addProduct, show]
  );

  function handleBack() {
    if (cart.length === 0) {
      navigation.goBack();
      return;
    }
    Alert.alert("Leave this sale?", "Keep the cart to come back to it, or discard it.", [
      { text: "Keep cart", onPress: () => navigation.goBack() },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          clearCart();
          navigation.goBack();
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refreshCatalog();
    setRefreshing(false);
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="New sale"
        subtitle={`${products.length} products`}
        onBack={handleBack}
        right={<IconButton icon="scan-outline" onPress={() => navigation.navigate("Scan")} />}
      />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, SKU or barcode"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {categories.length > 0 ? (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {[null, ...categories].map((name) => {
              const active = name === category;
              return (
                <TouchableOpacity
                  key={name ?? "all"}
                  onPress={() => setCategory(name)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{name ?? "All"}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {loadingCatalog && products.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : catalogError && products.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{catalogError}</Text>
          <Button label="Try again" onPress={refreshCatalog} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(product) => product.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, { paddingBottom: 120 + insets.bottom }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          initialNumToRender={14}
          windowSize={9}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No products found"
              message={query ? `Nothing matches "${query}".` : "No products available at this location."}
            />
          }
          renderItem={({ item }) => (
            <ProductRow product={item} quantity={quantities.get(item.id) ?? 0} currency={currency} onAdd={handleAdd} />
          )}
        />
      )}

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {itemCount > 0 ? (
          <Button
            large
            icon="receipt-outline"
            label={`Review sale · ${itemCount} item${itemCount === 1 ? "" : "s"} · ${formatMoney(subtotal, currency)}`}
            onPress={() => navigation.navigate("Checkout")}
          />
        ) : (
          <Text style={styles.bottomHint}>Tap a product or scan a barcode to start the sale</Text>
        )}
      </View>

      <Toast toast={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 },
  chips: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  chipLabelActive: { color: "#a5a8ff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  errorText: { color: colors.danger, fontSize: 14, textAlign: "center" },
  list: { paddingHorizontal: 16 },
  separator: { height: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowDisabled: { opacity: 0.45 },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: { width: 48, height: 48 },
  rowBody: { flex: 1 },
  rowName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  rowPrice: { color: colors.text, fontSize: 13, marginTop: 2 },
  rowStock: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  rowStockLow: { color: colors.warning },
  rowStockOut: { color: colors.danger },
  qtyBadge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBadgeText: { color: "#0B0F1A", fontWeight: "800", fontSize: 14 },
  addButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
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
  bottomHint: { color: colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 14 },
});