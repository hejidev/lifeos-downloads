import type { Sale } from "../types";

export type RootStackParamList = {
  Shift: undefined;
  Sale: undefined;
  Scan: undefined;
  Checkout: undefined;
  Receipt: { sale: Sale; cashReceived?: number };
};