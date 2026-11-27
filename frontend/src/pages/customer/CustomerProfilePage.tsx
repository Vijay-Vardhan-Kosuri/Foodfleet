import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MapPin, Plus, Trash2, User } from "lucide-react";
import { api, extractApiError } from "../../lib/api";
import { Address, Restaurant } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export const CustomerProfilePage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.customer_profile?.default_city || "Bengaluru");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [favourites, setFavourites] = useState<{ id: number; restaurant_detail: Restaurant }[]>([]);
  const [newAddress, setNewAddress] = useState({
    label: "Work",
    street_address: "",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560001",
  });

  const loadData = () => {
    api.get<Address[]>("/auth/addresses/").then((r) => setAddresses(r.data)).catch(() => {});
    api.get("/favourites/").then((r) => setFavourites(r.data)).catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch("/auth/profile/", {
        first_name: firstName,
        last_name: lastName,
        phone,
        default_city: city,
      });
      await refreshProfile();
      showToast("Profile updated!");
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/auth/addresses/", newAddress);
      setNewAddress({ label: "Home", street_address: "", city: "Bengaluru", state: "Karnataka", postal_code: "560001" });
      loadData();
      showToast("Address added");
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const deleteAddress = async (id: number) => {
    try {
      await api.delete(`/auth/addresses/${id}/`);
      loadData();
      showToast("Address removed");
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  return (
    <div className="min-h-screen bg-cream py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <h1 className="font-display text-3xl font-extrabold">Profile, Addresses & Favourites</h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <form onSubmit={saveProfile} className="lg:col-span-5 rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <User className="w-5 h-5 text-food-orange" /> Personal Details
            </h2>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              className="w-full rounded-xl border border-charcoal/15 px-3.5 py-2.5 text-sm"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              className="w-full rounded-xl border border-charcoal/15 px-3.5 py-2.5 text-sm"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="w-full rounded-xl border border-charcoal/15 px-3.5 py-2.5 text-sm"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Default City"
              className="w-full rounded-xl border border-charcoal/15 px-3.5 py-2.5 text-sm"
            />
            <button type="submit" className="w-full rounded-full bg-charcoal py-3 text-xs font-bold text-cream hover:bg-food-orange transition">
              Save Changes
            </button>
          </form>

          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <MapPin className="w-5 h-5 text-food-orange" /> Saved Addresses
              </h2>
              <div className="space-y-2.5">
                {addresses.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-2xl border border-charcoal/10 p-3.5 text-xs">
                    <div>
                      <p className="font-bold text-charcoal">
                        {a.label} {a.is_default && <span className="text-food-orange">(Default)</span>}
                      </p>
                      <p className="text-charcoal/70">
                        {a.street_address}, {a.city}, {a.state} {a.postal_code}
                      </p>
                    </div>
                    <button onClick={() => deleteAddress(a.id)} className="text-red-600 p-1.5">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={addAddress} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-3 border-t border-charcoal/10">
                <input
                  required
                  placeholder="Label"
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
                />
                <input
                  required
                  placeholder="Street Address"
                  value={newAddress.street_address}
                  onChange={(e) => setNewAddress({ ...newAddress, street_address: e.target.value })}
                  className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
                />
                <input
                  required
                  placeholder="City"
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
                />
                <input
                  required
                  placeholder="Postal Code"
                  value={newAddress.postal_code}
                  onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                  className="rounded-xl border border-charcoal/15 px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 rounded-full bg-charcoal py-2.5 text-xs font-bold text-cream"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Address
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Heart className="w-5 h-5 text-food-orange" /> Favourite Kitchens
              </h2>
              {favourites.length === 0 ? (
                <p className="text-xs text-warm-grey">No favourites saved yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {favourites.map((f) => (
                    <Link
                      key={f.id}
                      to={`/restaurants/${f.restaurant_detail.id}`}
                      className="rounded-2xl border border-charcoal/10 p-3.5 hover:border-food-orange transition"
                    >
                      <p className="font-display text-sm font-bold">{f.restaurant_detail.name}</p>
                      <p className="text-xs text-warm-grey">{f.restaurant_detail.address?.city}</p>
                    </Link>
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
