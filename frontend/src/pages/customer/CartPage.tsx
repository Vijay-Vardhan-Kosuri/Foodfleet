import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Minus, Plus, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";
import { formatINR } from "../../lib/format";
import { useCart } from "../../context/CartContext";
import { PhotoFrame } from "../../components/ui/PhotoFrame";

interface PublicCoupon {
  id: number;
  code: string;
  description: string;
}

export const CartPage: React.FC = () => {
  const { cart, loading, updateQuantity, removeItem, applyCoupon, removeCoupon } = useCart();
  const [couponInput, setCouponInput] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState<PublicCoupon[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<PublicCoupon[]>("/coupons/active/")
      .then((res) => setAvailableCoupons(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-charcoal border-t-food-orange" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-[75vh] bg-cream flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-[2rem] border border-charcoal/10 bg-white p-10 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cream text-food-orange">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h1 className="font-display text-2xl font-extrabold">Your Cart is Empty</h1>
          <p className="text-sm text-charcoal/70">Explore approved kitchens and add freshly prepared dishes.</p>
          <Link
            to="/restaurants"
            className="inline-flex items-center gap-2 rounded-full bg-charcoal px-6 py-3 text-sm font-bold text-cream hover:bg-food-orange transition"
          >
            Browse Restaurants <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const hasUnavailable = cart.totals.unavailable_items.length > 0;

  return (
    <div className="min-h-screen bg-cream py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-food-orange">Order Bag</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold">Your Cart from {cart.restaurant_name}</h1>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-4">
            {cart.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-3xl border border-charcoal/10 bg-white p-4 shadow-sm"
              >
                <PhotoFrame src={item.image_url} alt={item.food_name} className="h-20 w-20 rounded-2xl shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${item.is_vegetarian ? "bg-emerald-600" : "bg-red-600"}`}
                    />
                    <h3 className="font-display text-base font-bold truncate">{item.food_name}</h3>
                  </div>
                  <p className="text-xs text-warm-grey mt-0.5">{formatINR(item.unit_price)} each</p>
                  {!item.is_available && (
                    <p className="text-xs font-bold text-red-600 mt-1">Currently unavailable — remove to checkout</p>
                  )}
                </div>
                <div className="flex items-center gap-2 rounded-full border border-charcoal/15 bg-cream/40 px-2 py-1">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    aria-label="Decrease quantity"
                    className="p-1 hover:text-food-orange"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="min-w-[20px] text-center text-xs font-bold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    aria-label="Increase quantity"
                    className="p-1 hover:text-food-orange"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-right min-w-[78px]">
                  <p className="font-display text-sm font-extrabold">{formatINR(item.line_total)}</p>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-5 space-y-5">
            {/* Coupons */}
            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
              <div className="flex items-center gap-2 font-display text-base font-bold">
                <Tag className="w-4 h-4 text-food-orange" /> Promo Code
              </div>
              {cart.coupon_code ? (
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-bold text-emerald-900">
                  <span>Applied: {cart.coupon_code}</span>
                  <button onClick={removeCoupon} className="inline-flex items-center gap-1 text-red-600">
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (couponInput.trim()) {
                      const ok = await applyCoupon(couponInput.trim());
                      if (ok) setCouponInput("");
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter code (e.g. FLEET20)"
                    className="flex-1 rounded-xl border border-charcoal/15 bg-cream/30 px-3.5 py-2.5 text-xs font-bold uppercase outline-none focus:border-food-orange"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-charcoal px-4 py-2.5 text-xs font-bold text-cream hover:bg-food-orange transition"
                  >
                    Apply
                  </button>
                </form>
              )}
              {availableCoupons.length > 0 && !cart.coupon_code && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-warm-grey">Available Promos</p>
                  {availableCoupons.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => applyCoupon(c.code)}
                      className="w-full flex items-center justify-between rounded-xl border border-dashed border-charcoal/20 px-3 py-2 text-left text-xs hover:border-food-orange"
                    >
                      <span className="font-bold text-food-orange">{c.code}</span>
                      <span className="text-charcoal/70 truncate ml-2">{c.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bill Summary */}
            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
              <h2 className="font-display text-lg font-extrabold">Bill Summary</h2>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-charcoal/80">
                  <span>Subtotal</span>
                  <span className="font-semibold">{formatINR(cart.totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-charcoal/80">
                  <span>Taxes (GST)</span>
                  <span className="font-semibold">{formatINR(cart.totals.tax_amount)}</span>
                </div>
                <div className="flex justify-between text-charcoal/80">
                  <span>Delivery Fee</span>
                  <span className="font-semibold">{formatINR(cart.totals.delivery_fee)}</span>
                </div>
                {Number(cart.totals.discount_amount) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Promo Discount</span>
                    <span>-{formatINR(cart.totals.discount_amount)}</span>
                  </div>
                )}
                <div className="border-t border-charcoal/10 pt-3 flex justify-between font-display text-lg font-extrabold">
                  <span>Total Payable</span>
                  <span>{formatINR(cart.totals.total_amount)}</span>
                </div>
              </div>

              {cart.totals.coupon_error && (
                <p className="text-xs font-semibold text-amber-700">{cart.totals.coupon_error}</p>
              )}

              <button
                type="button"
                disabled={hasUnavailable}
                onClick={() => navigate("/checkout")}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-charcoal py-3.5 text-sm font-bold text-cream hover:bg-food-orange transition disabled:opacity-40"
              >
                Proceed to Checkout <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
