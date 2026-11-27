import { OrderStatus, UserRole } from "../types";

export function formatINR(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getRoleHomeRoute(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin/dashboard";
    case "RESTAURANT_OWNER":
      return "/restaurant/dashboard";
    case "DELIVERY_PARTNER":
      return "/delivery/dashboard";
    default:
      return "/restaurants";
  }
}

export function getOrderStatusBadge(status: OrderStatus): { label: string; classes: string } {
  switch (status) {
    case "DELIVERED":
      return { label: "Delivered", classes: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    case "OUT_FOR_DELIVERY":
    case "PICKED_UP":
      return { label: status.replace(/_/g, " "), classes: "bg-food-orange/15 text-food-orange border-food-orange/30" };
    case "PREPARING":
    case "CONFIRMED":
    case "READY_FOR_PICKUP":
      return { label: status.replace(/_/g, " "), classes: "bg-amber-100 text-amber-800 border-amber-200" };
    case "CANCELLED":
    case "REJECTED":
    case "PAYMENT_FAILED":
      return { label: status.replace(/_/g, " "), classes: "bg-red-100 text-red-800 border-red-200" };
    case "REFUND_PENDING":
    case "REFUNDED":
      return { label: status.replace(/_/g, " "), classes: "bg-stone-200 text-stone-800 border-stone-300" };
    default:
      return { label: status.replace(/_/g, " "), classes: "bg-charcoal/10 text-charcoal border-charcoal/20" };
  }
}
