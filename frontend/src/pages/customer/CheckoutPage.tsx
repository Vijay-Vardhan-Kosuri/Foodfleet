import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, CreditCard, MapPin, Plus, ShieldCheck } from "lucide-react";
import { api, extractApiError } from "../../lib/api";
import { formatINR } from "../../lib/format";
import { Address } from "../../types";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";

export const CheckoutPage: React.FC = () => {
  const { cart, refreshCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"SIMULATED_CARD" | "UPI" | "RAZORPAY" | "COD">("SIMULATED_CARD");
  const [instructions, setInstructions] = useState("");
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({
    label: "Home",
    street_address: "",
    apartment: "",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560038",
  });
  const [submitting, setSubmitting] = useState(false);

  const loadAddresses = async () => {
    try {
      const res = await api.get<Address[]>("/auth/addresses/");
      setAddresses(res.data);
      const def = res.data.find((a) => a.is_default) || res.data[0];
      if (def) setSelectedAddressId(def.id);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post<Address>("/auth/addresses/", { ...newAddr, is_default: true });
      await loadAddresses();
      setSelectedAddressId(res.data.id);
      setShowNewAddr(false);
      showToast("Delivery address saved");
    } catch (err) {
      showToast(extractApiError(err, "Failed to save address."), "error");
    }
  };

  const handlePlaceOrder = async (simulateOutcome: "SUCCESS" | "FAILED" = "SUCCESS") => {
    if (!selectedAddressId) {
      showToast("Please select or add a delivery address.", "warning");
      return;
    }
    if (!cart || cart.items.length === 0) {
      showToast("Your cart is empty.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const idempotencyKey = `ff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const orderRes = await api.post("/orders/", {
        address_id: selectedAddressId,
        payment_method: paymentMethod,
        special_instructions: instructions,
        idempotency_key: idempotencyKey,
      });
      const order = orderRes.data;

      if (paymentMethod !== "COD") {
        await api.post("/payments/create/", { order_id: order.id, idempotency_key: `pay_${idempotencyKey}` });
        await api.post("/payments/verify/", { order_id: order.id, simulate_outcome: simulateOutcome });
      }

      await refreshCart();
      showToast(`Order ${order.order_number} confirmed!`);
      navigate(`/orders/${order.id}`);
    } catch (err) {
      showToast(extractApiError(err, "Checkout failed."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-[70vh] bg-cream flex items-center justify-center p-6">
        <div className="rounded-3xl bg-white p-10 text-center border border-charcoal/10">
          <h2 className="font-display text-xl font-bold">No items in cart</h2>
          <button
            onClick={() => navigate("/restaurants")}
            className="mt-4 rounded-full bg-charcoal px-6 py-2.5 text-sm font-bold text-cream"
          >
            Browse Restaurants
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-food-orange">Secure Checkout</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold">Complete Your Order</h1>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Address */}
            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <MapPin className="w-5 h-5 text-food-orange" /> Delivery Address
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNewAddr((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-food-orange hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Address
                </button>
              </div>

              {showNewAddr && (
                <form onSubmit={handleSaveAddress} className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-2xl bg-cream/60 p-4">
                  <input
                    required
                    placeholder="Label (Home / Work)"
                    value={newAddr.label}
                    onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                    className="rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    required
                    placeholder="Street Address"
                    value={newAddr.street_address}
                    onChange={(e) => setNewAddr({ ...newAddr, street_address: e.target.value })}
                    className="rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Apartment / Landmark"
                    value={newAddr.apartment}
                    onChange={(e) => setNewAddr({ ...newAddr, apartment: e.target.value })}
                    className="rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    required
                    placeholder="City"
                    value={newAddr.city}
                    onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                    className="rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    required
                    placeholder="State"
                    value={newAddr.state}
                    onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
                    className="rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    required
                    placeholder="Postal Code"
                    value={newAddr.postal_code}
                    onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })}
                    className="rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="sm:col-span-2 rounded-full bg-charcoal py-2.5 text-xs font-bold text-cream"
                  >
                    Save Address
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {addresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => setSelectedAddressId(addr.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selectedAddressId === addr.id
                        ? "border-food-orange bg-food-orange/5 ring-2 ring-food-orange/20"
                        : "border-charcoal/15 hover:border-charcoal/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-bold">{addr.label}</span>
                      {selectedAddressId === addr.id && <CheckCircle2 className="w-4 h-4 text-food-orange" />}
                    </div>
                    <p className="mt-1 text-xs text-charcoal/75">
                      {addr.street_address}
                      {addr.apartment ? `, ${addr.apartment}` : ""}
                    </p>
                    <p className="text-xs text-warm-grey">
                      {addr.city}, {addr.state} {addr.postal_code}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Payment Method */}
            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <CreditCard className="w-5 h-5 text-food-orange" /> Payment Method
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { id: "SIMULATED_CARD", title: "Card (Test Gateway)", sub: "Instant simulated authorization" },
                  { id: "UPI", title: "UPI (Test Mode)", sub: "Verified instant UPI settlement" },
                  { id: "RAZORPAY", title: "Razorpay Test", sub: "Razorpay test order & signature flow" },
                  { id: "COD", title: "Cash on Delivery", sub: "Pay rider upon doorstep delivery" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as typeof paymentMethod)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      paymentMethod === m.id
                        ? "border-charcoal bg-charcoal text-cream"
                        : "border-charcoal/15 bg-cream/30 text-charcoal"
                    }`}
                  >
                    <p className="font-display text-sm font-bold">{m.title}</p>
                    <p className={`text-[11px] mt-0.5 ${paymentMethod === m.id ? "text-cream/70" : "text-warm-grey"}`}>
                      {m.sub}
                    </p>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/75 mb-1.5">
                  Delivery / Kitchen Instructions
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="E.g., Leave at reception, extra napkins..."
                  className="w-full rounded-xl border border-charcoal/15 bg-cream/30 px-4 py-2.5 text-sm outline-none focus:border-food-orange"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-5 sticky top-24">
              <h2 className="font-display text-lg font-extrabold">Order Summary ({cart.restaurant_name})</h2>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <span className="text-charcoal/85">
                      {item.quantity} × {item.food_name}
                    </span>
                    <span className="font-bold">{formatINR(item.line_total)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-charcoal/10 pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-charcoal/75">Subtotal</span>
                  <span>{formatINR(cart.totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal/75">Tax & Delivery</span>
                  <span>{formatINR(Number(cart.totals.tax_amount) + Number(cart.totals.delivery_fee))}</span>
                </div>
                {Number(cart.totals.discount_amount) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount</span>
                    <span>-{formatINR(cart.totals.discount_amount)}</span>
                  </div>
                )}
                <div className="border-t border-charcoal/10 pt-3 flex justify-between font-display text-xl font-extrabold">
                  <span>Grand Total</span>
                  <span>{formatINR(cart.totals.total_amount)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handlePlaceOrder("SUCCESS")}
                className="w-full rounded-full bg-food-orange py-4 text-sm font-bold text-white hover:bg-charcoal transition disabled:opacity-50"
              >
                {submitting ? "Processing Order..." : `Place Order & Pay ${formatINR(cart.totals.total_amount)}`}
              </button>

              <p className="flex items-center justify-center gap-1.5 text-[11px] text-warm-grey">
                <ShieldCheck className="w-4 h-4 text-muted-olive" /> No raw card data is ever stored on FoodFleet servers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
