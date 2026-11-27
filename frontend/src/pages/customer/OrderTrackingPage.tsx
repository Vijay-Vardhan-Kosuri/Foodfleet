import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Phone, RefreshCw, Star, Wifi } from "lucide-react";
import { api, extractApiError, WS_BASE_URL } from "../../lib/api";
import { formatDateTime, formatINR, getOrderStatusBadge } from "../../lib/format";
import { Order } from "../../types";
import { useToast } from "../../context/ToastContext";
import { OrderTracker } from "../../components/orders/OrderTracker";
import { DeliveryMap } from "../../components/map/DeliveryMap";

export const OrderTrackingPage: React.FC = () => {
  const { id } = useParams();
  const { showToast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const [rating, setRating] = useState(5);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [complaintSubject, setComplaintSubject] = useState("");
  const [complaintDesc, setComplaintDesc] = useState("");
  const [complaints, setComplaints] = useState<{ id: number; subject: string; status: string; resolution_notes: string }[]>([]);
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      const [res, cmpRes] = await Promise.all([
        api.get<Order>(`/orders/${id}/`),
        api.get(`/reviews/complaints/`).catch(() => ({ data: [] })),
      ]);
      setOrder(res.data);
      const allCmp = Array.isArray(cmpRes.data) ? cmpRes.data : cmpRes.data?.results || [];
      setComplaints(allCmp.filter((c: { order: number }) => c.order === Number(id)));
    } catch (err) {
      showToast(extractApiError(err, "Unable to fetch order."), "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // WebSocket real-time connection with polling fallback
  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("ff_access_token");
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`${WS_BASE_URL}/ws/orders/${id}/?token=${encodeURIComponent(token || "")}`);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
      ws.onmessage = () => {
        fetchOrder();
      };
    } catch {
      setWsConnected(false);
    }

    const pollInterval = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        fetchOrder();
      }
    }, 8000);

    return () => {
      clearInterval(pollInterval);
      if (ws) ws.close();
    };
  }, [id, fetchOrder]);

  const handleCancelOrder = async () => {
    if (!order) return;
    const reason = window.prompt("Reason for cancellation:", "Changed my mind");
    if (reason === null) return;
    try {
      const res = await api.patch<Order>(`/orders/${order.id}/status/`, {
        status: "CANCELLED",
        notes: reason,
      });
      setOrder(res.data);
      showToast("Order cancellation processed.");
    } catch (err) {
      showToast(extractApiError(err, "Cannot cancel order."), "error");
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setSubmittingReview(true);
    try {
      await api.post("/reviews/", {
        order: order.id,
        rating,
        delivery_rating: deliveryRating,
        comment,
      });
      showToast("Thank you for your review!");
      fetchOrder();
    } catch (err) {
      showToast(extractApiError(err, "Failed to submit review."), "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setSubmittingComplaint(true);
    try {
      await api.post("/reviews/complaints/", {
        order: order.id,
        subject: complaintSubject,
        description: complaintDesc,
      });
      setComplaintSubject("");
      setComplaintDesc("");
      showToast("Support ticket submitted. Our team will review it shortly.");
      fetchOrder();
    } catch (err) {
      showToast(extractApiError(err, "Failed to submit issue."), "error");
    } finally {
      setSubmittingComplaint(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-cream flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-charcoal border-t-food-orange" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[60vh] bg-cream flex items-center justify-center p-6">
        <div className="rounded-3xl bg-white p-10 text-center border border-charcoal/10">
          <h2 className="font-display text-xl font-bold">Order Not Found</h2>
          <Link to="/orders" className="mt-4 inline-block text-sm font-bold text-food-orange underline">
            Back to Order History
          </Link>
        </div>
      </div>
    );
  }

  const badge = getOrderStatusBadge(order.status);
  const canCancel = order.status === "PLACED" || order.status === "CONFIRMED";
  const pickupLat = Number(order.restaurant_address?.latitude || 12.971599);
  const pickupLng = Number(order.restaurant_address?.longitude || 77.594563);
  const dropLat = Number(order.delivery_lat || 12.978369);
  const dropLng = Number(order.delivery_lng || 77.640836);

  return (
    <div className="min-h-screen bg-cream py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-display text-3xl font-extrabold">{order.order_number}</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badge.classes}`}>{badge.label}</span>
            </div>
            <p className="mt-1 text-xs text-charcoal/70">
              Ordered from <strong>{order.restaurant_name}</strong> on {formatDateTime(order.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                wsConnected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              <Wifi className="w-3.5 h-3.5" /> {wsConnected ? "Live WebSocket" : "Auto-Polling"}
            </span>
            <button
              onClick={fetchOrder}
              className="inline-flex items-center gap-1.5 rounded-full border border-charcoal/15 bg-white px-4 py-2 text-xs font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            {canCancel && (
              <button
                onClick={handleCancelOrder}
                className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
              >
                Cancel Order
              </button>
            )}
          </div>
        </div>

        {/* Visual Progress Tracker */}
        <div className="rounded-3xl border border-charcoal/10 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="font-display text-base font-bold mb-6">Live Order Progress</h2>
          <OrderTracker status={order.status} />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Map + Delivery Partner */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
              <h2 className="font-display text-lg font-bold">Live Route Map (OpenStreetMap)</h2>
              <DeliveryMap
                pickupLat={pickupLat}
                pickupLng={pickupLng}
                pickupLabel={order.restaurant_name}
                dropLat={dropLat}
                dropLng={dropLng}
                dropLabel={order.delivery_address_snapshot.street_address || "Delivery Address"}
                riderLat={order.delivery_partner ? Number(order.delivery_partner.current_lat) : undefined}
                riderLng={order.delivery_partner ? Number(order.delivery_partner.current_lng) : undefined}
                riderLabel={order.delivery_partner?.name}
              />
            </div>

            {order.delivery_partner && (
              <div className="rounded-3xl border border-charcoal/10 bg-charcoal text-cream p-6 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-food-orange">Assigned Fleet Partner</p>
                  <p className="mt-1 font-display text-xl font-bold">{order.delivery_partner.name}</p>
                  <p className="text-xs text-cream/70">
                    {order.delivery_partner.vehicle_type} • {order.delivery_partner.vehicle_number}
                  </p>
                </div>
                {order.delivery_partner.phone && (
                  <a
                    href={`tel:${order.delivery_partner.phone}`}
                    className="inline-flex items-center gap-2 rounded-full bg-food-orange px-4 py-2.5 text-xs font-bold text-white"
                  >
                    <Phone className="w-4 h-4" /> Call Rider
                  </a>
                )}
              </div>
            )}

            {/* Review Form for Delivered Orders */}
            {order.status === "DELIVERED" && !order.has_review && (
              <form onSubmit={handleReviewSubmit} className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
                <h3 className="font-display text-lg font-bold">Rate Your Order</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1">Food Quality (1–5)</label>
                    <select
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      className="w-full rounded-xl border border-charcoal/15 px-3 py-2 text-sm"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} ★
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Delivery Experience (1–5)</label>
                    <select
                      value={deliveryRating}
                      onChange={(e) => setDeliveryRating(Number(e.target.value))}
                      className="w-full rounded-xl border border-charcoal/15 px-3 py-2 text-sm"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} ★
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share how the meal and delivery were..."
                  className="w-full rounded-xl border border-charcoal/15 bg-cream/30 px-4 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="inline-flex items-center gap-2 rounded-full bg-charcoal px-6 py-2.5 text-xs font-bold text-cream hover:bg-food-orange transition"
                >
                  <Star className="w-3.5 h-3.5" /> {submittingReview ? "Submitting..." : "Submit Review"}
                </button>
              </form>
            )}

            {/* Support / Complaint Form */}
            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
              <h3 className="font-display text-lg font-bold">Need Help With This Order?</h3>
              {complaints.length > 0 && (
                <div className="space-y-2">
                  {complaints.map((c) => (
                    <div key={c.id} className="rounded-2xl bg-cream/60 px-4 py-3 text-xs">
                      <div className="flex justify-between font-bold">
                        <span>{c.subject}</span>
                        <span className="text-food-orange">{c.status}</span>
                      </div>
                      {c.resolution_notes && <p className="mt-1 text-charcoal/75">{c.resolution_notes}</p>}
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleComplaintSubmit} className="space-y-3">
                <input
                  required
                  value={complaintSubject}
                  onChange={(e) => setComplaintSubject(e.target.value)}
                  placeholder="Issue summary (e.g. Missing item, late delivery)"
                  className="w-full rounded-xl border border-charcoal/15 bg-cream/30 px-4 py-2.5 text-sm"
                />
                <textarea
                  required
                  rows={2}
                  value={complaintDesc}
                  onChange={(e) => setComplaintDesc(e.target.value)}
                  placeholder="Describe the issue..."
                  className="w-full rounded-xl border border-charcoal/15 bg-cream/30 px-4 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={submittingComplaint}
                  className="rounded-full border border-charcoal/20 px-5 py-2 text-xs font-bold hover:bg-charcoal hover:text-cream transition"
                >
                  {submittingComplaint ? "Submitting..." : "Report Issue"}
                </button>
              </form>
            </div>
          </div>

          {/* Receipt & Audit Timeline */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
              <h2 className="font-display text-lg font-bold">Order Receipt</h2>
              <div className="space-y-2 border-b border-charcoal/10 pb-3 text-sm">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>
                      {item.quantity} × {item.food_name_snapshot}
                    </span>
                    <span className="font-semibold">{formatINR(item.total_price)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 text-xs text-charcoal/75">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatINR(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes</span>
                  <span>{formatINR(order.tax_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span>{formatINR(order.delivery_fee)}</span>
                </div>
                {Number(order.discount_amount) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Coupon ({order.coupon_code})</span>
                    <span>-{formatINR(order.discount_amount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-charcoal/10 flex justify-between font-display text-base font-extrabold text-charcoal">
                  <span>Total ({order.payment_method})</span>
                  <span>{formatINR(order.total_amount)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-3">
              <h2 className="font-display text-lg font-bold">Status Timeline</h2>
              <div className="space-y-3">
                {order.status_history.map((h) => (
                  <div key={h.id} className="border-l-2 border-food-orange pl-3 text-xs">
                    <p className="font-bold text-charcoal">{h.to_status.replace(/_/g, " ")}</p>
                    <p className="text-charcoal/70">{h.notes || `Updated by ${h.actor_role}`}</p>
                    <p className="text-[10px] text-warm-grey">{formatDateTime(h.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
