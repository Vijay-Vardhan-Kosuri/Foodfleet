import React, { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Check, ChefHat, Clock, Plus, Star, Store, Trash2, UtensilsCrossed, X } from "lucide-react";
import { api, extractApiError } from "../../lib/api";
import { formatDateTime, formatINR, getOrderStatusBadge } from "../../lib/format";
import { FoodCategory, FoodItem, OperatingHours, Order, Restaurant } from "../../types";
import { useToast } from "../../context/ToastContext";

interface AnalyticsData {
  total_orders: number;
  today_orders: number;
  pending_orders: number;
  completed_orders: number;
  total_sales: number;
  average_order_value: number;
  daily_sales: { day: string; revenue: number; orders: number }[];
  weekly_sales: { week: string; revenue: number; orders: number }[];
  monthly_revenue: { month: string; revenue: number; orders: number }[];
  best_selling_items: { food_name_snapshot: string; quantity: number; revenue: number }[];
  status_distribution: { status: string; count: number }[];
}

const CHART_COLORS = ["#F47738", "#171717", "#858B65", "#A6A29B", "#D97706", "#16A34A"];

export const RestaurantDashboardPage: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"overview" | "orders" | "menu" | "profile" | "reviews">("overview");
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [noRestaurant, setNoRestaurant] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [hours, setHours] = useState<OperatingHours[]>([]);
  const [reviews, setReviews] = useState<{ id: number; customer_name: string; rating: number; comment: string; created_at: string }[]>([]);

  // Registration form state
  const [regForm, setRegForm] = useState({
    name: "",
    description: "",
    phone: "",
    email: "",
    street_address: "",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560001",
    price_for_two: "500",
  });

  // New Category & New Food Item
  const [newCatName, setNewCatName] = useState("");
  const [newDish, setNewDish] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    is_vegetarian: true,
    image_url: "",
  });
  const [dishFile, setDishFile] = useState<File | null>(null);
  const [editingDish, setEditingDish] = useState<FoodItem | null>(null);

  const [profileForm, setProfileForm] = useState({
    name: "",
    description: "",
    phone: "",
    delivery_fee: "",
    min_order_amount: "",
    price_for_two: "",
    avg_delivery_time_mins: "30",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const restRes = await api.get<Restaurant>("/restaurants/my/");
      setRestaurant(restRes.data);
      setProfileForm({
        name: restRes.data.name,
        description: restRes.data.description,
        phone: restRes.data.phone,
        delivery_fee: restRes.data.delivery_fee,
        min_order_amount: restRes.data.min_order_amount,
        price_for_two: restRes.data.price_for_two,
        avg_delivery_time_mins: String(restRes.data.avg_delivery_time_mins),
      });
      setNoRestaurant(false);

      const [anRes, ordRes, catRes, foodRes, hrsRes, revRes] = await Promise.all([
        api.get<AnalyticsData>("/restaurants/my/analytics/"),
        api.get<{ results?: Order[] } | Order[]>("/orders/"),
        api.get<FoodCategory[]>("/food-categories/"),
        api.get<{ results?: FoodItem[] } | FoodItem[]>("/food/?mine=1"),
        api.get<OperatingHours[]>("/restaurants/my/operating-hours/"),
        api.get<{ results?: typeof reviews } | typeof reviews>("/reviews/?mine=1"),
      ]);
      setAnalytics(anRes.data);
      setOrders(Array.isArray(ordRes.data) ? ordRes.data : ordRes.data.results || []);
      setCategories(catRes.data);
      setFoodItems(Array.isArray(foodRes.data) ? foodRes.data : foodRes.data.results || []);
      setHours(hrsRes.data);
      setReviews(Array.isArray(revRes.data) ? revRes.data : revRes.data.results || []);
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number } };
      if (anyErr?.response?.status === 404) {
        setNoRestaurant(true);
      }
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRegisterRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/restaurants/", {
        name: regForm.name,
        description: regForm.description,
        phone: regForm.phone,
        email: regForm.email,
        price_for_two: regForm.price_for_two,
        address: {
          street_address: regForm.street_address,
          city: regForm.city,
          state: regForm.state,
          postal_code: regForm.postal_code,
        },
      });
      showToast("Restaurant submitted for Super Admin approval!");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err, "Registration failed."), "error");
    }
  };

  const handleOrderAction = async (orderId: number, status: string) => {
    try {
      await api.patch(`/orders/${orderId}/status/`, { status });
      showToast(`Order updated to ${status.replace(/_/g, " ")}`);
      loadAll();
    } catch (err) {
      showToast(extractApiError(err, "Action failed."), "error");
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post("/food-categories/", { name: newCatName.trim() });
      setNewCatName("");
      showToast("Category added");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const form = new FormData();
      form.append("name", newDish.name);
      form.append("description", newDish.description);
      form.append("price", newDish.price);
      if (newDish.category) form.append("category", newDish.category);
      form.append("is_vegetarian", String(newDish.is_vegetarian));
      if (newDish.image_url) form.append("image_url", newDish.image_url);
      if (dishFile) form.append("image", dishFile);
      await api.post("/food/", form, { headers: { "Content-Type": "multipart/form-data" } });
      setNewDish({ name: "", description: "", price: "", category: "", is_vegetarian: true, image_url: "" });
      setDishFile(null);
      showToast("Dish added to menu");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const handleUpdateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDish) return;
    try {
      await api.patch(`/food/${editingDish.id}/`, {
        name: editingDish.name,
        description: editingDish.description,
        price: editingDish.price,
        discount_price: editingDish.discount_price || null,
        is_vegetarian: editingDish.is_vegetarian,
      });
      setEditingDish(null);
      showToast("Dish updated");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const saveRestaurantProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const form = new FormData();
      Object.entries(profileForm).forEach(([k, v]) => form.append(k, v));
      if (logoFile) form.append("logo", logoFile);
      if (coverFile) form.append("cover_image", coverFile);
      await api.patch("/restaurants/my/", form, { headers: { "Content-Type": "multipart/form-data" } });
      setLogoFile(null);
      setCoverFile(null);
      showToast("Restaurant profile & media updated");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err, "Failed to update profile."), "error");
    }
  };

  const toggleDishAvailability = async (item: FoodItem) => {
    try {
      await api.patch(`/food/${item.id}/`, { is_available: !item.is_available });
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const deleteDish = async (id: number) => {
    try {
      await api.delete(`/food/${id}/`);
      showToast("Dish removed");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const toggleOpen = async () => {
    if (!restaurant) return;
    try {
      await api.patch("/restaurants/my/", { is_open: !restaurant.is_open });
      showToast(restaurant.is_open ? "Kitchen marked Closed" : "Kitchen marked Open");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const saveHours = async () => {
    try {
      await api.put("/restaurants/my/operating-hours/", { hours });
      showToast("Operating hours saved");
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  if (noRestaurant) {
    return (
      <div className="min-h-screen bg-cream py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-charcoal/10 bg-white p-8 shadow-xl space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-food-orange">Kitchen Onboarding</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold">Register Your Restaurant</h1>
            <p className="mt-1 text-sm text-charcoal/70">
              Submit your kitchen profile for Super Admin verification before accepting live customer orders.
            </p>
          </div>
          <form onSubmit={handleRegisterRestaurant} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              required
              placeholder="Restaurant Name"
              value={regForm.name}
              onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
              className="sm:col-span-2 rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm"
            />
            <textarea
              required
              placeholder="Culinary description"
              value={regForm.description}
              onChange={(e) => setRegForm({ ...regForm, description: e.target.value })}
              className="sm:col-span-2 rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm"
            />
            <input
              required
              placeholder="Contact Phone"
              value={regForm.phone}
              onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
              className="rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm"
            />
            <input
              required
              type="email"
              placeholder="Business Email"
              value={regForm.email}
              onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
              className="rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm"
            />
            <input
              required
              placeholder="Street Address"
              value={regForm.street_address}
              onChange={(e) => setRegForm({ ...regForm, street_address: e.target.value })}
              className="sm:col-span-2 rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm"
            />
            <input
              required
              placeholder="City"
              value={regForm.city}
              onChange={(e) => setRegForm({ ...regForm, city: e.target.value })}
              className="rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm"
            />
            <input
              required
              placeholder="Postal Code"
              value={regForm.postal_code}
              onChange={(e) => setRegForm({ ...regForm, postal_code: e.target.value })}
              className="rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="sm:col-span-2 rounded-full bg-charcoal py-3.5 text-sm font-bold text-cream hover:bg-food-orange transition"
            >
              Submit Restaurant for Approval
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Store className="w-6 h-6 text-food-orange" />
              <h1 className="font-display text-3xl font-extrabold">{restaurant?.name || "Restaurant Console"}</h1>
              {restaurant && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    restaurant.approval_status === "APPROVED"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {restaurant.approval_status}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-charcoal/70">Manage incoming orders, menu items, hours & revenue analytics.</p>
          </div>
          {restaurant && (
            <button
              onClick={toggleOpen}
              className={`rounded-full px-5 py-2.5 text-xs font-bold transition ${
                restaurant.is_open ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
              }`}
            >
              {restaurant.is_open ? "Accepting Orders (Open)" : "Kitchen Closed"}
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-charcoal/10 pb-3">
          {[
            { id: "overview", label: "Overview & Analytics" },
            { id: "orders", label: `Orders (${orders.length})` },
            { id: "menu", label: `Menu (${foodItems.length})` },
            { id: "profile", label: "Profile & Hours" },
            { id: "reviews", label: `Reviews (${reviews.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`rounded-full px-5 py-2 text-xs font-bold transition ${
                tab === t.id ? "bg-charcoal text-cream" : "bg-white text-charcoal border border-charcoal/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview & Analytics */}
        {tab === "overview" && analytics && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
              {[
                { label: "Total Orders", val: analytics.total_orders },
                { label: "Today's Orders", val: analytics.today_orders },
                { label: "Pending", val: analytics.pending_orders },
                { label: "Completed", val: analytics.completed_orders },
                { label: "Total Sales", val: formatINR(analytics.total_sales) },
                { label: "Avg Order Value", val: formatINR(analytics.average_order_value) },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-3xl border border-charcoal/10 bg-white p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-warm-grey">{kpi.label}</p>
                  <p className="mt-2 font-display text-2xl font-extrabold text-charcoal">{kpi.val}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-charcoal/10 bg-white p-6">
                <h3 className="font-display text-base font-bold mb-4">Daily Sales (₹)</h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.daily_sales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="#F47738" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-charcoal/10 bg-white p-6">
                <h3 className="font-display text-base font-bold mb-4">Weekly Sales & Monthly Revenue (₹)</h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.weekly_sales.length > 0 ? analytics.weekly_sales : analytics.monthly_revenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" />
                      <XAxis dataKey={analytics.weekly_sales.length > 0 ? "week" : "month"} tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="#858B65" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-charcoal/10 bg-white p-6">
                <h3 className="font-display text-base font-bold mb-4">Monthly Revenue Trend (₹)</h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.monthly_revenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="#171717" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-charcoal/10 bg-white p-6">
                <h3 className="font-display text-base font-bold mb-4">Best-Selling Dishes</h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.best_selling_items} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="food_name_snapshot" type="category" width={110} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="quantity" fill="#F47738" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-2 rounded-3xl border border-charcoal/10 bg-white p-6">
                <h3 className="font-display text-base font-bold mb-4">Order Status Distribution</h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.status_distribution}
                        dataKey="count"
                        nameKey="status"
                        outerRadius={80}
                        label
                      >
                        {analytics.status_distribution.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Orders Management */}
        {tab === "orders" && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="rounded-3xl bg-white p-10 text-center text-sm text-warm-grey">No orders received yet.</div>
            ) : (
              orders.map((order) => {
                const badge = getOrderStatusBadge(order.status);
                return (
                  <div key={order.id} className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-display text-lg font-extrabold">{order.order_number}</span>
                          <span className={`rounded-full border px-3 py-0.5 text-xs font-bold ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs text-warm-grey mt-0.5">
                          Customer: {order.customer_name} • {formatDateTime(order.created_at)}
                        </p>
                      </div>
                      <span className="font-display text-xl font-extrabold">{formatINR(order.total_amount)}</span>
                    </div>

                    <div className="text-xs text-charcoal/80">
                      {order.items.map((i) => `${i.quantity}× ${i.food_name_snapshot}`).join(" • ")}
                    </div>

                    {order.delivery_partner && (
                      <div className="rounded-2xl bg-cream/60 px-4 py-2.5 text-xs">
                        <strong>Assigned Rider:</strong> {order.delivery_partner.name} ({order.delivery_partner.phone}) —{" "}
                        {order.delivery_partner.assignment_status}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      {order.status === "PLACED" && (
                        <>
                          <button
                            onClick={() => handleOrderAction(order.id, "CONFIRMED")}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
                          >
                            <Check className="w-3.5 h-3.5" /> Accept Order
                          </button>
                          <button
                            onClick={() => handleOrderAction(order.id, "REJECTED")}
                            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {order.status === "CONFIRMED" && (
                        <button
                          onClick={() => handleOrderAction(order.id, "PREPARING")}
                          className="inline-flex items-center gap-1.5 rounded-full bg-food-orange px-4 py-2 text-xs font-bold text-white"
                        >
                          <ChefHat className="w-3.5 h-3.5" /> Start Preparing
                        </button>
                      )}
                      {order.status === "PREPARING" && (
                        <button
                          onClick={() => handleOrderAction(order.id, "READY_FOR_PICKUP")}
                          className="inline-flex items-center gap-1.5 rounded-full bg-charcoal px-4 py-2 text-xs font-bold text-cream"
                        >
                          <UtensilsCrossed className="w-3.5 h-3.5" /> Mark Ready for Pickup
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 3: Menu Management */}
        {tab === "menu" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-6">
              <form onSubmit={handleCreateCategory} className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-3">
                <h3 className="font-display text-base font-bold">Add Menu Category</h3>
                <div className="flex gap-2">
                  <input
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Appetizers"
                    className="flex-1 rounded-xl border border-charcoal/15 px-3 py-2 text-sm"
                  />
                  <button type="submit" className="rounded-xl bg-charcoal px-4 py-2 text-xs font-bold text-cream">
                    Add
                  </button>
                </div>
              </form>

              <form onSubmit={handleCreateDish} className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-3">
                <h3 className="font-display text-base font-bold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-food-orange" /> Add Food Item
                </h3>
                <input
                  required
                  placeholder="Dish Name"
                  value={newDish.name}
                  onChange={(e) => setNewDish({ ...newDish, name: e.target.value })}
                  className="w-full rounded-xl border border-charcoal/15 px-3.5 py-2.5 text-sm"
                />
                <textarea
                  placeholder="Description"
                  value={newDish.description}
                  onChange={(e) => setNewDish({ ...newDish, description: e.target.value })}
                  className="w-full rounded-xl border border-charcoal/15 px-3.5 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="Price (₹)"
                    value={newDish.price}
                    onChange={(e) => setNewDish({ ...newDish, price: e.target.value })}
                    className="rounded-xl border border-charcoal/15 px-3.5 py-2 text-sm"
                  />
                  <select
                    value={newDish.category}
                    onChange={(e) => setNewDish({ ...newDish, category: e.target.value })}
                    className="rounded-xl border border-charcoal/15 px-3 py-2 text-sm"
                  >
                    <option value="">No Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  placeholder="Photo URL (optional)"
                  value={newDish.image_url}
                  onChange={(e) => setNewDish({ ...newDish, image_url: e.target.value })}
                  className="w-full rounded-xl border border-charcoal/15 px-3.5 py-2 text-sm"
                />
                <div className="text-xs">
                  <label className="block font-bold mb-1 text-charcoal/75">Or Upload Dish Image</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setDishFile(e.target.files?.[0] || null)}
                    className="w-full text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={newDish.is_vegetarian}
                    onChange={(e) => setNewDish({ ...newDish, is_vegetarian: e.target.checked })}
                  />
                  Vegetarian Dish
                </label>
                <button
                  type="submit"
                  className="w-full rounded-full bg-food-orange py-3 text-xs font-bold text-white hover:bg-charcoal transition"
                >
                  Create Menu Item
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-3">
              {foodItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-3xl border border-charcoal/10 bg-white p-4">
                  <div>
                    <p className="font-display text-base font-bold">{item.name}</p>
                    <p className="text-xs text-warm-grey">
                      {item.category_name || "General"} • {formatINR(item.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingDish(item)}
                      className="rounded-full border border-charcoal/20 px-3 py-1.5 text-xs font-bold hover:bg-charcoal hover:text-cream transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleDishAvailability(item)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                        item.is_available ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-700"
                      }`}
                    >
                      {item.is_available ? "In Stock" : "Sold Out"}
                    </button>
                    <button onClick={() => deleteDish(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-full">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {editingDish && (
                <form onSubmit={handleUpdateDish} className="rounded-3xl border-2 border-food-orange bg-white p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-sm font-bold">Editing: {editingDish.name}</h4>
                    <button type="button" onClick={() => setEditingDish(null)} className="text-xs font-bold text-warm-grey">
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={editingDish.name}
                      onChange={(e) => setEditingDish({ ...editingDish, name: e.target.value })}
                      className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={editingDish.price}
                      onChange={(e) => setEditingDish({ ...editingDish, price: e.target.value })}
                      className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
                    />
                  </div>
                  <textarea
                    value={editingDish.description}
                    onChange={(e) => setEditingDish({ ...editingDish, description: e.target.value })}
                    className="w-full rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
                  />
                  <button type="submit" className="rounded-full bg-charcoal px-5 py-2 text-xs font-bold text-cream">
                    Save Dish Changes
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Profile & Operating Hours */}
        {tab === "profile" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <form onSubmit={saveRestaurantProfile} className="lg:col-span-6 rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
              <h3 className="font-display text-lg font-bold">Restaurant Profile & Media</h3>
              <input
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="Restaurant Name"
                className="w-full rounded-xl border border-charcoal/15 px-3.5 py-2.5 text-sm"
              />
              <textarea
                rows={3}
                value={profileForm.description}
                onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                placeholder="Description"
                className="w-full rounded-xl border border-charcoal/15 px-3.5 py-2.5 text-sm"
              />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold mb-1">Phone</label>
                  <input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-charcoal/15 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Delivery Fee (₹)</label>
                  <input
                    value={profileForm.delivery_fee}
                    onChange={(e) => setProfileForm({ ...profileForm, delivery_fee: e.target.value })}
                    className="w-full rounded-xl border border-charcoal/15 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Min Order (₹)</label>
                  <input
                    value={profileForm.min_order_amount}
                    onChange={(e) => setProfileForm({ ...profileForm, min_order_amount: e.target.value })}
                    className="w-full rounded-xl border border-charcoal/15 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Avg Delivery Time (mins)</label>
                  <input
                    value={profileForm.avg_delivery_time_mins}
                    onChange={(e) => setProfileForm({ ...profileForm, avg_delivery_time_mins: e.target.value })}
                    className="w-full rounded-xl border border-charcoal/15 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold mb-1">Upload Logo</label>
                  <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                </div>
                <div>
                  <label className="block font-bold mb-1">Upload Cover Photo</label>
                  <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              <button type="submit" className="rounded-full bg-food-orange px-6 py-2.5 text-xs font-bold text-white">
                Update Profile & Photos
              </button>
            </form>

            <div className="lg:col-span-6 rounded-3xl border border-charcoal/10 bg-white p-6 space-y-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                <Clock className="w-5 h-5 text-food-orange" /> Weekly Operating Hours
              </h3>
            <div className="space-y-2.5">
              {hours.map((h, idx) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-charcoal/10 px-4 py-3 text-sm">
                  <span className="w-28 font-bold">{h.day_name}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={h.open_time.slice(0, 5)}
                      onChange={(e) => {
                        const next = [...hours];
                        next[idx] = { ...h, open_time: e.target.value };
                        setHours(next);
                      }}
                      className="rounded-lg border border-charcoal/15 px-2 py-1 text-xs"
                    />
                    <span>to</span>
                    <input
                      type="time"
                      value={h.close_time.slice(0, 5)}
                      onChange={(e) => {
                        const next = [...hours];
                        next[idx] = { ...h, close_time: e.target.value };
                        setHours(next);
                      }}
                      className="rounded-lg border border-charcoal/15 px-2 py-1 text-xs"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={h.is_closed}
                      onChange={(e) => {
                        const next = [...hours];
                        next[idx] = { ...h, is_closed: e.target.checked };
                        setHours(next);
                      }}
                    />
                    Closed
                  </label>
                </div>
              ))}
            </div>
            <button
              onClick={saveHours}
              className="rounded-full bg-charcoal px-6 py-3 text-xs font-bold text-cream hover:bg-food-orange transition"
            >
              Save Operating Hours
            </button>
            </div>
          </div>
        )}

        {/* Tab 5: Reviews */}
        {tab === "reviews" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-3xl border border-charcoal/10 bg-white p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold">{r.customer_name}</span>
                  <span className="flex items-center gap-1 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-food-orange text-food-orange" /> {r.rating}
                  </span>
                </div>
                <p className="text-xs text-charcoal/75">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
