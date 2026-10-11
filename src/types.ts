export type StaffPermission = "CREATE_SALE" | "CREATE_CUSTOMER";

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "MOBILE_MONEY";

export interface StaffProfile {
  id: string;
  name: string;
  role: string;
  status: string;
}

export interface LoyaltyConfig {
  enabled: boolean;
  redemptionValue: number;
  earnRate: number;
}

export interface MeResponse {
  staff: StaffProfile;
  businessName?: string;
  storeName?: string;
  currency?: string;
  permissions?: StaffPermission[];
  loyalty?: LoyaltyConfig;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  category?: string;
  price: number;
  stock: number;
  lowStockAt: number;
  imageUrl?: string;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyaltyPoints: number;
  totalSpent: number;
  orderCount: number;
}

export interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  stock: number;
  imageUrl?: string;
}

export interface SaleItem {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  customerName?: string;
  storeName?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  description: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export interface MyShift {
  id: string;
  startsAt: string;
  endsAt: string;
  storeName?: string;
  note?: string;
}