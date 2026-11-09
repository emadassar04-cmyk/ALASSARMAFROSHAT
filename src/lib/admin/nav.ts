// أقسام لوحة الإدارة: كل قسم يظهر فقط لمن يملك صلاحيته (والتحقق الفعلي في الخادم وقاعدة البيانات)
import type { Dict } from "./dict/ar";

export type NavIcon =
  | "dashboard" | "orders" | "sale" | "purchases" | "customers" | "products" | "categories" | "inventory" | "coupons"
  | "expenses" | "profits" | "reports" | "campaigns" | "marketing" | "staff" | "activity" | "delivery" | "branches" | "integrations";

type Key = Exclude<keyof Dict["nav"], "groups" | "collapse" | "expand" | "openMenu" | "closeMenu" | "settings">;
type Group = keyof Dict["nav"]["groups"];

export const NAV: { href: string; key: Key; icon: NavIcon; group: Group; perm?: string | string[]; strong?: boolean }[] = [
  { href: "/admin", key: "dashboard", icon: "dashboard", group: "overview" },
  { href: "/admin/orders", key: "orders", icon: "orders", group: "sales", perm: "orders.read" },
  { href: "/admin/sales", key: "recordSale", icon: "sale", group: "sales", perm: "sales.record", strong: true },
  { href: "/admin/purchases", key: "purchases", icon: "purchases", group: "sales", perm: "sales.review" },
  { href: "/admin/customers", key: "customers", icon: "customers", group: "sales", perm: "orders.read" },
  { href: "/admin/products", key: "products", icon: "products", group: "catalog", perm: "catalog.manage" },
  { href: "/admin/categories", key: "categories", icon: "categories", group: "catalog", perm: "catalog.manage" },
  { href: "/admin/inventory", key: "inventory", icon: "inventory", group: "catalog", perm: "inventory.manage" },
  { href: "/admin/coupons", key: "coupons", icon: "coupons", group: "catalog", perm: "catalog.manage" },
  { href: "/admin/expenses", key: "expenses", icon: "expenses", group: "finance", perm: "finance.manage" },
  { href: "/admin/profits", key: "profits", icon: "profits", group: "finance", perm: "finance.read" },
  { href: "/admin/reports", key: "reports", icon: "reports", group: "finance", perm: "finance.read" },
  { href: "/admin/campaigns", key: "campaigns", icon: "campaigns", group: "marketing", perm: "campaigns.manage" },
  { href: "/admin/settings/marketing", key: "marketing", icon: "marketing", group: "marketing", perm: "settings.manage" },
  { href: "/admin/staff", key: "staff", icon: "staff", group: "admin", perm: "staff.manage" },
  { href: "/admin/activity", key: "activity", icon: "activity", group: "admin", perm: "audit.read" },
  { href: "/admin/settings/delivery", key: "delivery", icon: "delivery", group: "admin", perm: "settings.manage" },
  { href: "/admin/settings/branches", key: "branches", icon: "branches", group: "admin", perm: "settings.manage" },
  { href: "/admin/settings/integrations", key: "integrations", icon: "integrations", group: "admin", perm: "settings.manage" },
];

export function navFor(permissions: string[]) {
  return NAV.filter((n) => !n.perm || (Array.isArray(n.perm) ? n.perm.some((p) => permissions.includes(p)) : permissions.includes(n.perm)));
}
