import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Package } from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime, formatINR, getOrderStatusBadge } from "../../lib/format";
import { Order } from "../../types";

export const OrderHistoryPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ results?: Order[] } | Order[]>("/orders/")
      .then((res) => setOrders(Array.isArray(res.data) ? res.data : res.data.results || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-cream py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-food-orange">Customer Orders</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold">Order History & Tracking</h1>
          </div>
          <Link
            to="/restaurants"
            className="rounded-full bg-charcoal px-5 py-2.5 text-xs font-bold text-cream hover:bg-food-orange transition"
          >
            Order Food
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-3xl bg-white" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-charcoal/10 bg-white p-12 text-center space-y-4">
            <Package className="w-10 h-10 text-food-orange mx-auto" />
            <h2 className="font-display text-xl font-bold">No orders placed yet</h2>
            <Link to="/restaurants" className="inline-block text-sm font-bold text-food-orange underline">
              Explore restaurants →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const badge = getOrderStatusBadge(order.status);
              return (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-charcoal/10 bg-white p-6 hover:shadow-lg transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="font-display text-lg font-extrabold">{order.order_number}</span>
                      <span className={`rounded-full border px-3 py-0.5 text-[11px] font-bold ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-charcoal">{order.restaurant_name}</p>
                    <p className="text-xs text-warm-grey">
                      {order.items.map((i) => `${i.quantity}× ${i.food_name_snapshot}`).join(", ")}
                    </p>
                    <p className="text-[11px] text-warm-grey">{formatDateTime(order.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-display text-lg font-extrabold">{formatINR(order.total_amount)}</p>
                      <p className="text-[11px] text-warm-grey">{order.payment_status}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-food-orange" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
