import React from "react";
import { Check, ChefHat, PackageCheck, Bike, Navigation, Home, AlertCircle } from "lucide-react";
import { OrderStatus } from "../../types";

const STEPS: { key: OrderStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "PLACED", label: "Placed", icon: Check },
  { key: "CONFIRMED", label: "Confirmed", icon: Check },
  { key: "PREPARING", label: "Preparing", icon: ChefHat },
  { key: "READY_FOR_PICKUP", label: "Ready", icon: PackageCheck },
  { key: "PICKED_UP", label: "Picked Up", icon: Bike },
  { key: "OUT_FOR_DELIVERY", label: "On the Way", icon: Navigation },
  { key: "DELIVERED", label: "Delivered", icon: Home },
];

export const OrderTracker: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const terminalNegative = ["REJECTED", "CANCELLED", "PAYMENT_FAILED", "REFUND_PENDING", "REFUNDED"].includes(
    status
  );

  if (terminalNegative) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-900">
        <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
        <div>
          <p className="text-sm font-bold uppercase tracking-wide">{status.replace(/_/g, " ")}</p>
          <p className="text-xs text-red-700">
            This order exited the standard delivery flow. Check status history below for details.
          </p>
        </div>
      </div>
    );
  }

  const activeIdx = Math.max(
    0,
    STEPS.findIndex((s) => s.key === status)
  );

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex min-w-[640px] items-center justify-between gap-2">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const completed = idx <= activeIdx;
          const current = idx === activeIdx;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                    current
                      ? "border-food-orange bg-food-orange text-white shadow-lg shadow-food-orange/30 scale-105"
                      : completed
                        ? "border-charcoal bg-charcoal text-cream"
                        : "border-charcoal/15 bg-white text-warm-grey"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`text-[11px] font-semibold tracking-tight ${
                    completed ? "text-charcoal" : "text-warm-grey"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded-full transition-colors ${
                    idx < activeIdx ? "bg-charcoal" : "bg-charcoal/15"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
