import React, { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Search, ShieldCheck } from "lucide-react";
import { api, extractApiError } from "../../lib/api";
import { formatDateTime, formatINR } from "../../lib/format";
import { CuisineCategory, DeliveryPartnerProfile, Order, Restaurant, User } from "../../types";
import { useToast } from "../../context/ToastContext";

interface AdminOverview {
  total_customers: number;
  total_restaurants: number;
  pending_restaurant_approvals: number;
  total_delivery_partners: number;
  available_delivery_partners: number;
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  total_platform_revenue: number;
  platform_commission: number;
  open_complaints: number;
  pending_refunds: number;
}

interface AdminAnalytics {
  daily_revenue: { day: string; revenue: number; commission: number; orders: number }[];
  top_restaurants: { restaurant__name: string; revenue: number; orders: number }[];
}

export const SuperAdminDashboardPage: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<
    "overview" | "users" | "restaurants" | "partners" | "orders" | "payments" | "promos" | "moderation" | "audit" | "config"
  >("overview");

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [partners, setPartners] = useState<DeliveryPartnerProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [categories, setCategories] = useState<CuisineCategory[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRiderByOrder, setSelectedRiderByOrder] = useState<Record<number, string>>({});
  const [newCoupon, setNewCoupon] = useState({ code: "", description: "", discount_value: "15", valid_until: "2027-12-31T23:59:00Z" });
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [newUser, setNewUser] = useState({ email: "", password: "", first_name: "", role: "CUSTOMER" });

  const loadAll = useCallback(async () => {
    try {
      const [ov, an, us, rs, dp, ord, pay, ref, cpn, cat, rev, cmp, aud, cfg] = await Promise.all([
        api.get("/admin/dashboard/"),
        api.get("/admin/analytics/"),
        api.get("/admin/users/"),
        api.get("/admin/restaurants/"),
        api.get("/admin/delivery-partners/"),
        api.get("/admin/orders/"),
        api.get("/admin/payments/"),
        api.get("/admin/refunds/"),
        api.get("/admin/coupons/"),
        api.get("/admin/categories/"),
        api.get("/admin/reviews/"),
        api.get("/admin/complaints/"),
        api.get("/admin/audit-logs/"),
        api.get("/admin/config/"),
      ]);
      const unpack = (d: any) => (Array.isArray(d) ? d : d.results || []);
      setOverview(ov.data);
      setAnalytics(an.data);
      setUsers(unpack(us.data));
      setRestaurants(unpack(rs.data));
      setPartners(unpack(dp.data));
      setOrders(unpack(ord.data));
      setPayments(unpack(pay.data));
      setRefunds(unpack(ref.data));
      setCoupons(unpack(cpn.data));
      setCategories(unpack(cat.data));
      setReviews(unpack(rev.data));
      setComplaints(unpack(cmp.data));
      setAuditLogs(unpack(aud.data));
      setConfig(cfg.data);
    } catch (err) {
      showToast(extractApiError(err, "Failed to load Super Admin console."), "error");
    }
  }, [showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const toggleUserSuspension = async (u: User) => {
    try {
      await api.patch(`/admin/users/${u.id}/suspend/`, { is_suspended: !u.is_suspended });
      showToast(u.is_suspended ? "User reactivated" : "User suspended");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/admin/users/", newUser);
      setNewUser({ email: "", password: "", first_name: "", role: "CUSTOMER" });
      showToast("User created");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const updateRestaurantApproval = async (id: number, approval_status: string) => {
    try {
      await api.patch(`/admin/restaurants/${id}/approval/`, { approval_status });
      showToast(`Restaurant marked ${approval_status}`);
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const verifyPartner = async (id: number, verification_status: string) => {
    try {
      await api.patch(`/admin/delivery-partners/${id}/verify/`, { verification_status });
      showToast(`Partner ${verification_status}`);
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const assignDelivery = async (orderId: number) => {
    const partnerId = selectedRiderByOrder[orderId];
    if (!partnerId) {
      showToast("Select an available delivery partner first.", "warning");
      return;
    }
    try {
      await api.post(`/admin/orders/${orderId}/assign-delivery/`, { delivery_partner_id: Number(partnerId) });
      showToast("Delivery partner assigned");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const processRefund = async (refundId: number, decision: "PROCESSED" | "REJECTED") => {
    try {
      await api.post(`/admin/refunds/${refundId}/process/`, { decision });
      showToast(`Refund ${decision.toLowerCase()}`);
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/admin/coupons/", {
        ...newCoupon,
        code: newCoupon.code.toUpperCase(),
        discount_type: "PERCENTAGE",
      });
      setNewCoupon({ code: "", description: "", discount_value: "15", valid_until: "2027-12-31T23:59:00Z" });
      showToast("Coupon created");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/admin/categories/", newCategory);
      setNewCategory({ name: "", description: "" });
      showToast("Cuisine category created");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch("/admin/config/", config);
      showToast("Platform settings saved");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const q = searchTerm.trim().toLowerCase();
  const availablePartners = partners.filter((p) => p.availability_status === "AVAILABLE");

  return (
    <div className="min-h-screen bg-cream py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-food-orange" />
              <h1 className="font-display text-3xl font-extrabold">Super Admin Command Center</h1>
            </div>
            <p className="mt-1 text-xs text-charcoal/70">
              Platform-wide governance, approvals, dispatch orchestration, refunds, analytics & audit logs.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-charcoal/15 bg-white px-4 py-2">
            <Search className="w-4 h-4 text-warm-grey" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter tables..."
              className="text-xs outline-none bg-transparent"
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-charcoal/10 pb-3">
          {[
            { id: "overview", label: "Overview & Analytics" },
            { id: "users", label: `Users (${users.length})` },
            { id: "restaurants", label: `Restaurants (${restaurants.length})` },
            { id: "partners", label: `Delivery Fleet (${partners.length})` },
            { id: "orders", label: `Orders (${orders.length})` },
            { id: "payments", label: `Payments & Refunds (${refunds.length})` },
            { id: "promos", label: "Coupons & Cuisines" },
            { id: "moderation", label: "Reviews & Complaints" },
            { id: "audit", label: "Audit Logs" },
            { id: "config", label: "Settings" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                tab === t.id ? "bg-charcoal text-cream" : "bg-white text-charcoal border border-charcoal/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && overview && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Total Customers", val: overview.total_customers },
                { label: "Total Restaurants", val: `${overview.total_restaurants} (${overview.pending_restaurant_approvals} pending)` },
                { label: "Delivery Partners", val: `${overview.total_delivery_partners} (${overview.available_delivery_partners} online)` },
                { label: "Total / Pending Orders", val: `${overview.total_orders} / ${overview.pending_orders}` },
                { label: "Completed Orders", val: overview.completed_orders },
                { label: "Platform Revenue", val: formatINR(overview.total_platform_revenue) },
                { label: "Platform Commission", val: formatINR(overview.platform_commission) },
                { label: "Pending Refunds / Complaints", val: `${overview.pending_refunds} / ${overview.open_complaints}` },
              ].map((k) => (
                <div key={k.label} className="rounded-3xl border border-charcoal/10 bg-white p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-warm-grey">{k.label}</p>
                  <p className="mt-2 font-display text-xl font-extrabold text-charcoal">{k.val}</p>
                </div>
              ))}
            </div>

            {analytics && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-charcoal/10 bg-white p-6">
                  <h3 className="font-display text-base font-bold mb-4">Platform Revenue & Commission</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.daily_revenue}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="revenue" stroke="#171717" fill="#F47738" fillOpacity={0.25} />
                        <Area type="monotone" dataKey="commission" stroke="#858B65" fill="#858B65" fillOpacity={0.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-3xl border border-charcoal/10 bg-white p-6">
                  <h3 className="font-display text-base font-bold mb-4">Top Performing Restaurants</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.top_restaurants}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" />
                        <XAxis dataKey="restaurant__name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#171717" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users */}
        {tab === "users" && (
          <div className="space-y-6">
            <form onSubmit={createUser} className="grid grid-cols-1 gap-3 sm:grid-cols-5 rounded-3xl border border-charcoal/10 bg-white p-5">
              <input
                required
                placeholder="First Name"
                value={newUser.first_name}
                onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
              />
              <input
                required
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
              >
                <option value="CUSTOMER">Customer</option>
                <option value="RESTAURANT_OWNER">Restaurant Owner</option>
                <option value="DELIVERY_PARTNER">Delivery Partner</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
              <button type="submit" className="rounded-xl bg-charcoal text-xs font-bold text-cream py-2">
                Create User
              </button>
            </form>

            <div className="overflow-x-auto rounded-3xl border border-charcoal/10 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-charcoal/10 bg-cream/50 text-[11px] uppercase tracking-wider text-warm-grey">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/10">
                  {users
                    .filter((u) => !q || u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q))
                    .map((u) => (
                      <tr key={u.id}>
                        <td className="p-4 font-bold">{u.full_name}</td>
                        <td className="p-4">{u.email}</td>
                        <td className="p-4 font-semibold">{u.role}</td>
                        <td className="p-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-bold ${
                              u.is_suspended ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {u.is_suspended ? "Suspended" : "Active"}
                          </span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => toggleUserSuspension(u)}
                            className="rounded-full border border-charcoal/20 px-3 py-1 font-bold hover:bg-charcoal hover:text-cream transition"
                          >
                            {u.is_suspended ? "Reactivate" : "Suspend"}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Restaurants */}
        {tab === "restaurants" && (
          <div className="space-y-4">
            {restaurants
              .filter((r) => !q || r.name.toLowerCase().includes(q) || r.owner_email.toLowerCase().includes(q))
              .map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-charcoal/10 bg-white p-5">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-display text-lg font-bold">{r.name}</h3>
                      <span className="rounded-full bg-cream px-3 py-0.5 text-xs font-bold">{r.approval_status}</span>
                    </div>
                    <p className="text-xs text-warm-grey">
                      Owner: {r.owner_email} • {r.address?.city}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateRestaurantApproval(r.id, "APPROVED")}
                      className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateRestaurantApproval(r.id, "REJECTED")}
                      className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => updateRestaurantApproval(r.id, "SUSPENDED")}
                      className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white"
                    >
                      Suspend
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Delivery Partners */}
        {tab === "partners" && (
          <div className="space-y-4">
            {partners.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-charcoal/10 bg-white p-5">
                <div>
                  <h3 className="font-display text-base font-bold">{p.full_name}</h3>
                  <p className="text-xs text-warm-grey">
                    {p.email} • {p.vehicle_type} ({p.vehicle_number}) • Status: <strong>{p.availability_status}</strong> •
                    Verification: <strong>{p.verification_status}</strong>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => verifyPartner(p.id, "VERIFIED")}
                    className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white"
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => verifyPartner(p.id, "REJECTED")}
                    className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Orders & Delivery Assignment */}
        {tab === "orders" && (
          <div className="space-y-4">
            {orders
              .filter((o) => !q || o.order_number.toLowerCase().includes(q) || o.restaurant_name.toLowerCase().includes(q))
              .map((o) => (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-charcoal/10 bg-white p-5">
                  <div>
                    <p className="font-display text-base font-extrabold">
                      {o.order_number} — {o.status}
                    </p>
                    <p className="text-xs text-warm-grey">
                      {o.restaurant_name} → {o.customer_email} • {formatINR(o.total_amount)}
                    </p>
                    {o.delivery_partner && (
                      <p className="text-xs font-semibold text-muted-olive mt-1">
                        Assigned: {o.delivery_partner.name} ({o.delivery_partner.assignment_status})
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedRiderByOrder[o.id] || ""}
                      onChange={(e) => setSelectedRiderByOrder({ ...selectedRiderByOrder, [o.id]: e.target.value })}
                      className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
                    >
                      <option value="">Select Available Rider</option>
                      {availablePartners.map((ap) => (
                        <option key={ap.id} value={ap.id}>
                          {ap.full_name} ({ap.vehicle_type})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => assignDelivery(o.id)}
                      className="rounded-full bg-charcoal px-4 py-2 text-xs font-bold text-cream hover:bg-food-orange transition"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Payments & Refunds */}
        {tab === "payments" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-3">
              <h3 className="font-display text-lg font-bold">Payment Transactions</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between rounded-2xl bg-cream/40 p-3 text-xs">
                    <div>
                      <p className="font-bold">{p.order_number}</p>
                      <p className="text-warm-grey">{p.customer_email} • {p.gateway}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatINR(p.amount)}</p>
                      <p className="text-[11px] font-semibold">{p.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-3">
              <h3 className="font-display text-lg font-bold">Refund Requests</h3>
              {refunds.length === 0 ? (
                <p className="text-xs text-warm-grey">No refunds requested.</p>
              ) : (
                refunds.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-2xl border border-charcoal/10 p-3.5 text-xs">
                    <div>
                      <p className="font-bold">
                        {r.order_number} — {formatINR(r.amount)}
                      </p>
                      <p className="text-warm-grey">{r.reason} • {r.status}</p>
                    </div>
                    {r.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => processRefund(r.id, "PROCESSED")}
                          className="rounded-full bg-emerald-600 px-3 py-1 font-bold text-white"
                        >
                          Process
                        </button>
                        <button
                          onClick={() => processRefund(r.id, "REJECTED")}
                          className="rounded-full bg-red-600 px-3 py-1 font-bold text-white"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Coupons & Categories */}
        {tab === "promos" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
              <h3 className="font-display text-lg font-bold">Platform Coupons</h3>
              <form onSubmit={createCoupon} className="grid grid-cols-2 gap-2.5">
                <input
                  required
                  placeholder="Code (e.g. SAVE15)"
                  value={newCoupon.code}
                  onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })}
                  className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs uppercase"
                />
                <input
                  required
                  type="number"
                  placeholder="% Discount"
                  value={newCoupon.discount_value}
                  onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: e.target.value })}
                  className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
                />
                <input
                  required
                  placeholder="Description"
                  value={newCoupon.description}
                  onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
                  className="col-span-2 rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
                />
                <button type="submit" className="col-span-2 rounded-full bg-charcoal py-2.5 text-xs font-bold text-cream">
                  Create Coupon
                </button>
              </form>
              <div className="space-y-2">
                {coupons.map((c) => (
                  <div key={c.id} className="flex justify-between rounded-xl bg-cream/50 px-3.5 py-2 text-xs">
                    <span className="font-bold text-food-orange">{c.code}</span>
                    <span>{c.discount_value}% • Used {c.used_count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
              <h3 className="font-display text-lg font-bold">Cuisine Categories</h3>
              <form onSubmit={createCategory} className="flex gap-2">
                <input
                  required
                  placeholder="Category name"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="flex-1 rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
                />
                <button type="submit" className="rounded-xl bg-charcoal px-4 py-2 text-xs font-bold text-cream">
                  Add
                </button>
              </form>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <span key={c.id} className="rounded-full border border-charcoal/15 bg-cream/40 px-3.5 py-1.5 text-xs font-semibold">
                    {c.name} ({c.restaurant_count})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Moderation */}
        {tab === "moderation" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-3">
              <h3 className="font-display text-lg font-bold">Ratings & Reviews</h3>
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl bg-cream/40 p-3.5 text-xs space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>{r.restaurant_name} ({r.rating} ★)</span>
                    <button
                      onClick={async () => {
                        await api.patch(`/admin/reviews/${r.id}/moderate/`, { is_flagged: !r.is_flagged });
                        loadAll();
                      }}
                      className="text-food-orange underline"
                    >
                      {r.is_flagged ? "Unflag" : "Flag"}
                    </button>
                  </div>
                  <p className="text-charcoal/75">{r.comment}</p>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-3">
              <h3 className="font-display text-lg font-bold">Customer Complaints</h3>
              {complaints.length === 0 ? (
                <p className="text-xs text-warm-grey">No complaints filed.</p>
              ) : (
                complaints.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-charcoal/10 p-3.5 text-xs space-y-2">
                    <div className="flex justify-between font-bold">
                      <span>{c.subject}</span>
                      <span>{c.status}</span>
                    </div>
                    <p className="text-charcoal/70">{c.description}</p>
                    {c.status === "OPEN" && (
                      <button
                        onClick={async () => {
                          await api.patch(`/admin/complaints/${c.id}/resolve/`, {
                            status: "RESOLVED",
                            resolution_notes: "Resolved by Super Admin.",
                          });
                          loadAll();
                        }}
                        className="rounded-full bg-emerald-600 px-3 py-1 font-bold text-white"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Audit Logs */}
        {tab === "audit" && (
          <div className="overflow-x-auto rounded-3xl border border-charcoal/10 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-charcoal/10 bg-cream/50 text-[11px] uppercase tracking-wider text-warm-grey">
                <tr>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Actor</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/10">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="p-4 text-warm-grey">{formatDateTime(log.created_at)}</td>
                    <td className="p-4 font-semibold">{log.actor_email}</td>
                    <td className="p-4 font-bold text-food-orange">{log.action}</td>
                    <td className="p-4">
                      {log.target_model} #{log.target_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Settings */}
        {tab === "config" && config && (
          <form onSubmit={saveConfig} className="max-w-xl rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
            <h3 className="font-display text-lg font-bold">Platform Configuration</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold mb-1">Tax Rate (%)</label>
                <input
                  value={config.tax_rate_percent}
                  onChange={(e) => setConfig({ ...config, tax_rate_percent: e.target.value })}
                  className="w-full rounded-xl border border-charcoal/15 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Default Commission (%)</label>
                <input
                  value={config.default_commission_percent}
                  onChange={(e) => setConfig({ ...config, default_commission_percent: e.target.value })}
                  className="w-full rounded-xl border border-charcoal/15 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Default Delivery Fee (₹)</label>
                <input
                  value={config.default_delivery_fee}
                  onChange={(e) => setConfig({ ...config, default_delivery_fee: e.target.value })}
                  className="w-full rounded-xl border border-charcoal/15 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Support Email</label>
                <input
                  value={config.support_email}
                  onChange={(e) => setConfig({ ...config, support_email: e.target.value })}
                  className="w-full rounded-xl border border-charcoal/15 px-3 py-2"
                />
              </div>
            </div>
            <button type="submit" className="rounded-full bg-charcoal px-6 py-2.5 text-xs font-bold text-cream">
              Save Platform Settings
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
