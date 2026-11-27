import React, { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bike, Check, MapPin, Navigation, Power, Upload, X } from "lucide-react";
import { api, extractApiError } from "../../lib/api";
import { formatDateTime, formatINR } from "../../lib/format";
import { DeliveryAssignment, DeliveryPartnerProfile } from "../../types";
import { useToast } from "../../context/ToastContext";
import { DeliveryMap } from "../../components/map/DeliveryMap";

interface EarningsSummary {
  total_completed_deliveries: number;
  total_earnings: number;
  today_earnings: number;
  weekly_earnings: number;
  daily_breakdown: { day: string; earnings: number; deliveries: number }[];
}

export const DeliveryDashboardPage: React.FC = () => {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<DeliveryPartnerProfile | null>(null);
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [pRes, aRes, eRes] = await Promise.all([
        api.get<DeliveryPartnerProfile>("/auth/delivery-profile/"),
        api.get<{ results?: DeliveryAssignment[] } | DeliveryAssignment[]>("/delivery/assignments/"),
        api.get<EarningsSummary>("/delivery/earnings/"),
      ]);
      setProfile(pRes.data);
      setAssignments(Array.isArray(aRes.data) ? aRes.data : aRes.data.results || []);
      setEarnings(eRes.data);
    } catch (err) {
      showToast(extractApiError(err, "Failed to load delivery workspace."), "error");
    }
  }, [showToast]);

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 10000);
    return () => clearInterval(timer);
  }, [loadAll]);

  const setAvailability = async (status: "AVAILABLE" | "BUSY" | "OFFLINE") => {
    try {
      await api.post("/delivery/availability/", { availability_status: status });
      showToast(`Status updated to ${status}`);
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const handleAccept = async (id: number) => {
    try {
      await api.post(`/delivery/assignments/${id}/accept/`);
      showToast("Delivery accepted!");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const handleReject = async (id: number) => {
    try {
      await api.post(`/delivery/assignments/${id}/reject/`, { reason: "Rider unavailable" });
      showToast("Assignment declined");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const advanceStatus = async (id: number, nextStatus: string) => {
    try {
      await api.patch(`/delivery/assignments/${id}/status/`, { status: nextStatus });
      showToast(`Delivery marked ${nextStatus.replace(/_/g, " ")}`);
      loadAll();
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const uploadVerificationDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return;
    const form = new FormData();
    form.append("id_document", docFile);
    try {
      await api.patch("/auth/delivery-profile/", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDocFile(null);
      showToast("Verification document uploaded!");
      loadAll();
    } catch (err) {
      showToast(extractApiError(err, "Upload failed."), "error");
    }
  };

  const incoming = assignments.filter((a) => a.status === "ASSIGNED");
  const active = assignments.filter((a) =>
    ["ACCEPTED", "ARRIVED_AT_RESTAURANT", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(a.status)
  );
  const completed = assignments.filter((a) => a.status === "DELIVERED");

  return (
    <div className="min-h-screen bg-cream py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Bike className="w-6 h-6 text-food-orange" />
              <h1 className="font-display text-3xl font-extrabold">Delivery Fleet Console</h1>
            </div>
            <p className="mt-1 text-xs text-charcoal/70">
              {profile?.full_name} • {profile?.vehicle_type} ({profile?.vehicle_number || "No plate"}) • Verification:{" "}
              <strong>{profile?.verification_status}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-charcoal/15 bg-white p-1.5">
            {(["AVAILABLE", "BUSY", "OFFLINE"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setAvailability(st)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${
                  profile?.availability_status === st
                    ? st === "AVAILABLE"
                      ? "bg-emerald-600 text-white"
                      : st === "BUSY"
                        ? "bg-food-orange text-white"
                        : "bg-charcoal text-cream"
                    : "text-charcoal/70 hover:text-charcoal"
                }`}
              >
                <Power className="w-3.5 h-3.5" /> {st}
              </button>
            ))}
          </div>
        </div>

        {/* Earnings KPIs */}
        {earnings && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Today's Earnings", val: formatINR(earnings.today_earnings) },
              { label: "Weekly Earnings", val: formatINR(earnings.weekly_earnings) },
              { label: "Total Earnings", val: formatINR(earnings.total_earnings) },
              { label: "Completed Deliveries", val: earnings.total_completed_deliveries },
            ].map((k) => (
              <div key={k.label} className="rounded-3xl border border-charcoal/10 bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-warm-grey">{k.label}</p>
                <p className="mt-2 font-display text-2xl font-extrabold">{k.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Incoming Assignments */}
        {incoming.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display text-xl font-extrabold">Incoming Delivery Requests</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {incoming.map((a) => (
                <div key={a.id} className="rounded-3xl border-2 border-food-orange bg-white p-6 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg font-extrabold">{a.order_number}</span>
                    <span className="rounded-full bg-food-orange/15 px-3 py-1 text-xs font-bold text-food-orange">
                      Earn {formatINR(a.delivery_fee_earned)}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-charcoal/80">
                    <p>
                      <strong>Pickup:</strong> {a.restaurant_name} — {a.restaurant_address?.street_address}
                    </p>
                    <p>
                      <strong>Drop-off:</strong> {a.customer_name} — {a.delivery_address.street_address},{" "}
                      {a.delivery_address.city}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAccept(a.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-charcoal py-2.5 text-xs font-bold text-cream hover:bg-emerald-600 transition"
                    >
                      <Check className="w-4 h-4" /> Accept Delivery
                    </button>
                    <button
                      onClick={() => handleReject(a.id)}
                      className="inline-flex items-center justify-center gap-1 rounded-full border border-red-300 px-4 py-2.5 text-xs font-bold text-red-700"
                    >
                      <X className="w-4 h-4" /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Deliveries with Map */}
        <div className="space-y-4">
          <h2 className="font-display text-xl font-extrabold">Active Deliveries ({active.length})</h2>
          {active.length === 0 ? (
            <div className="rounded-3xl border border-charcoal/10 bg-white p-8 text-center text-sm text-warm-grey">
              No active deliveries right now. Keep your status set to AVAILABLE to receive dispatches.
            </div>
          ) : (
            active.map((a) => (
              <div key={a.id} className="grid grid-cols-1 gap-6 lg:grid-cols-12 rounded-3xl border border-charcoal/10 bg-white p-6">
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xl font-extrabold">{a.order_number}</span>
                    <span className="rounded-full bg-charcoal px-3 py-1 text-xs font-bold text-cream">
                      {a.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs text-charcoal/80">
                    <p className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-charcoal shrink-0 mt-0.5" />
                      <span>
                        <strong>Pickup:</strong> {a.restaurant_name} ({a.restaurant_phone})
                        <br />
                        {a.restaurant_address?.street_address}, {a.restaurant_address?.city}
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <Navigation className="w-4 h-4 text-food-orange shrink-0 mt-0.5" />
                      <span>
                        <strong>Drop-off:</strong> {a.customer_name} ({a.customer_phone})
                        <br />
                        {a.delivery_address.street_address}, {a.delivery_address.city}
                      </span>
                    </p>
                  </div>
                  <div className="pt-2 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-warm-grey">
                      Kitchen Status: {a.order_status.replace(/_/g, " ")}
                    </p>
                    {a.status === "ACCEPTED" && (
                      <button
                        onClick={() => advanceStatus(a.id, "ARRIVED_AT_RESTAURANT")}
                        className="w-full rounded-full bg-charcoal py-3 text-xs font-bold text-cream hover:bg-food-orange transition"
                      >
                        Mark Arrived at Restaurant
                      </button>
                    )}
                    {a.status === "ARRIVED_AT_RESTAURANT" && (
                      <button
                        onClick={() => advanceStatus(a.id, "PICKED_UP")}
                        className="w-full rounded-full bg-food-orange py-3 text-xs font-bold text-white"
                      >
                        Confirm Pickup
                      </button>
                    )}
                    {a.status === "PICKED_UP" && (
                      <button
                        onClick={() => advanceStatus(a.id, "OUT_FOR_DELIVERY")}
                        className="w-full rounded-full bg-food-orange py-3 text-xs font-bold text-white"
                      >
                        Start Out for Delivery
                      </button>
                    )}
                    {a.status === "OUT_FOR_DELIVERY" && (
                      <button
                        onClick={() => advanceStatus(a.id, "DELIVERED")}
                        className="w-full rounded-full bg-emerald-600 py-3 text-xs font-bold text-white"
                      >
                        Mark Order Delivered
                      </button>
                    )}
                  </div>
                </div>
                <div className="lg:col-span-7">
                  <DeliveryMap
                    pickupLat={Number(a.restaurant_address?.latitude || 12.971599)}
                    pickupLng={Number(a.restaurant_address?.longitude || 77.594563)}
                    pickupLabel={a.restaurant_name}
                    dropLat={Number(a.delivery_lat || 12.978369)}
                    dropLng={Number(a.delivery_lng || 77.640836)}
                    dropLabel={a.delivery_address.street_address || "Customer"}
                    riderLat={profile ? Number(profile.current_lat) : undefined}
                    riderLng={profile ? Number(profile.current_lng) : undefined}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Earnings Chart & Document Upload & History */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
            <h3 className="font-display text-lg font-bold">7-Day Earnings Breakdown</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={earnings?.daily_breakdown || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="earnings" fill="#858B65" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <form onSubmit={uploadVerificationDoc} className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-3">
              <h3 className="flex items-center gap-2 font-display text-base font-bold">
                <Upload className="w-4 h-4 text-food-orange" /> Verification Documents
              </h3>
              <p className="text-xs text-charcoal/70">Upload ID / driving license (PDF, JPG, PNG, max 5MB).</p>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                className="w-full text-xs"
              />
              <button
                type="submit"
                disabled={!docFile}
                className="rounded-full bg-charcoal px-5 py-2.5 text-xs font-bold text-cream disabled:opacity-40"
              >
                Upload Document
              </button>
            </form>

            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-3">
              <h3 className="font-display text-base font-bold">Completed Delivery History</h3>
              {completed.length === 0 ? (
                <p className="text-xs text-warm-grey">No completed deliveries yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {completed.map((c) => (
                    <div key={c.id} className="flex justify-between rounded-2xl bg-cream/50 px-3.5 py-2.5 text-xs">
                      <div>
                        <p className="font-bold">{c.order_number}</p>
                        <p className="text-[11px] text-warm-grey">{c.restaurant_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-700">+{formatINR(c.delivery_fee_earned)}</p>
                        <p className="text-[10px] text-warm-grey">{c.delivered_at ? formatDateTime(c.delivered_at) : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
