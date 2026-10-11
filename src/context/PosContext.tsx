import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, staffApi } from "../api/client";
import { useSession } from "./SessionContext";
import type { CartLine, Customer, Product } from "../types";

export type AddResult = "added" | "maxed" | "out_of_stock";

interface PosValue {
  products: Product[];
  customers: Customer[];
  loadingCatalog: boolean;
  catalogError: string | null;
  refreshCatalog: () => Promise<void>;
  findByBarcode: (code: string) => Promise<Product | null>;
  cart: CartLine[];
  itemCount: number;
  subtotal: number;
  addProduct: (product: Product) => AddResult;
  setQuantity: (productId: string, quantity: number) => void;
  removeLine: (productId: string) => void;
  clearCart: () => void;
  getQuantity: (productId: string) => number;
  addCustomer: (customer: Customer) => void;
}

const PosContext = createContext<PosValue | null>(null);

export function PosProvider({ children }: { children: React.ReactNode }) {
  const { handleAuthError } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const cartRef = useRef<CartLine[]>([]);
  const productsRef = useRef<Product[]>([]);

  const commitCart = useCallback((next: CartLine[]) => {
    cartRef.current = next;
    setCart(next);
  }, []);

  const refreshCatalog = useCallback(async () => {
    try {
      const [productData, customerData] = await Promise.all([
        staffApi.get<{ products: Product[] }>("/staff-pos/products"),
        staffApi.get<{ customers: Customer[] }>("/staff-pos/customers"),
      ]);
      productsRef.current = productData.products;
      setProducts(productData.products);
      setCustomers(customerData.customers);
      setCatalogError(null);

      if (cartRef.current.length > 0) {
        const fresh = new Map(productData.products.map((product) => [product.id, product]));
        const reconciled = cartRef.current.flatMap((line): CartLine[] => {
          const current = fresh.get(line.productId);
          if (!current || current.stock <= 0) return [];
          return [
            { ...line, unitPrice: current.price, stock: current.stock, quantity: Math.min(line.quantity, current.stock) },
          ];
        });
        commitCart(reconciled);
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      setCatalogError(err instanceof Error ? err.message : "Couldn't load products.");
    } finally {
      setLoadingCatalog(false);
    }
  }, [commitCart, handleAuthError]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const findByBarcode = useCallback(async (code: string) => {
    const local = productsRef.current.find((product) => product.barcode === code);
    if (local && local.stock > 0) return local;
    try {
      const { product } = await staffApi.get<{ product: Product }>(
        `/staff-pos/products/by-barcode/${encodeURIComponent(code)}`
      );
      const exists = productsRef.current.some((item) => item.id === product.id);
      const next = exists
        ? productsRef.current.map((item) => (item.id === product.id ? product : item))
        : [...productsRef.current, product];
      productsRef.current = next;
      setProducts(next);
      return product;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }, []);

  const addProduct = useCallback(
    (product: Product): AddResult => {
      if (product.stock <= 0) return "out_of_stock";
      const current = cartRef.current;
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return "maxed";
        commitCart(
          current.map((line) =>
            line.productId === product.id
              ? { ...line, quantity: line.quantity + 1, stock: product.stock, unitPrice: product.price }
              : line
          )
        );
        return "added";
      }
      commitCart([
        ...current,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: 1,
          stock: product.stock,
          imageUrl: product.imageUrl,
        },
      ]);
      return "added";
    },
    [commitCart]
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      const next = cartRef.current.flatMap((line): CartLine[] => {
        if (line.productId !== productId) return [line];
        const clamped = Math.min(Math.max(Math.floor(quantity), 0), line.stock);
        return clamped === 0 ? [] : [{ ...line, quantity: clamped }];
      });
      commitCart(next);
    },
    [commitCart]
  );

  const removeLine = useCallback(
    (productId: string) => commitCart(cartRef.current.filter((line) => line.productId !== productId)),
    [commitCart]
  );

  const clearCart = useCallback(() => commitCart([]), [commitCart]);

  const getQuantity = useCallback(
    (productId: string) => cartRef.current.find((line) => line.productId === productId)?.quantity ?? 0,
    []
  );

  const addCustomer = useCallback((customer: Customer) => setCustomers((prev) => [customer, ...prev]), []);

  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [cart]);

  const value = useMemo<PosValue>(
    () => ({
      products,
      customers,
      loadingCatalog,
      catalogError,
      refreshCatalog,
      findByBarcode,
      cart,
      itemCount,
      subtotal,
      addProduct,
      setQuantity,
      removeLine,
      clearCart,
      getQuantity,
      addCustomer,
    }),
    [
      products, customers, loadingCatalog, catalogError, refreshCatalog, findByBarcode, cart, itemCount,
      subtotal, addProduct, setQuantity, removeLine, clearCart, getQuantity, addCustomer,
    ]
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos() {
  const value = useContext(PosContext);
  if (!value) throw new Error("usePos must be used inside PosProvider");
  return value;
}