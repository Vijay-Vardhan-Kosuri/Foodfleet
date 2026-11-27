import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clock, Filter, Heart, MapPin, Search, Star } from "lucide-react";
import { api, extractApiError } from "../../lib/api";
import { formatINR } from "../../lib/format";
import { CuisineCategory, Restaurant } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { PhotoFrame } from "../../components/ui/PhotoFrame";

export const ExploreRestaurantsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [cuisines, setCuisines] = useState<CuisineCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [cuisine, setCuisine] = useState(searchParams.get("cuisine") || "");
  const [minRating, setMinRating] = useState(searchParams.get("min_rating") || "");
  const [maxTime, setMaxTime] = useState(searchParams.get("max_delivery_time") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("max_price") || "");

  useEffect(() => {
    api
      .get<CuisineCategory[]>("/cuisines/")
      .then((res) => setCuisines(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("search", q.trim());
      if (city.trim()) params.set("city", city.trim());
      if (cuisine) params.set("cuisine", cuisine);
      if (minRating) params.set("min_rating", minRating);
      if (maxTime) params.set("max_delivery_time", maxTime);
      if (maxPrice) params.set("max_price", maxPrice);

      const res = await api.get<{ results?: Restaurant[] } | Restaurant[]>(`/restaurants/?${params.toString()}`);
      setRestaurants(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      showToast(extractApiError(err, "Failed to load restaurants."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuisine, minRating, maxTime, maxPrice]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (city.trim()) next.set("city", city.trim());
    if (cuisine) next.set("cuisine", cuisine);
    setSearchParams(next);
    fetchRestaurants();
  };

  const toggleFav = async (e: React.MouseEvent, restaurantId: number) => {
    e.preventDefault();
    if (!user || user.role !== "CUSTOMER") {
      showToast("Log in as a customer to save favourites.", "warning");
      return;
    }
    try {
      const res = await api.post<{ is_favourite: boolean }>("/favourites/", { restaurant_id: restaurantId });
      setRestaurants((prev) =>
        prev.map((r) => (r.id === restaurantId ? { ...r, is_favourite: res.data.is_favourite } : r))
      );
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const resetFilters = () => {
    setQ("");
    setCity("");
    setCuisine("");
    setMinRating("");
    setMaxTime("");
    setMaxPrice("");
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-cream py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-food-orange">Approved Kitchens</p>
            <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight">Explore Restaurants</h1>
          </div>
          <p className="text-sm text-charcoal/70">{restaurants.length} kitchens available</p>
        </div>

        {/* Filter & Search Bar */}
        <div className="rounded-3xl border border-charcoal/10 bg-white p-5 shadow-sm space-y-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-5 flex items-center gap-2 rounded-2xl border border-charcoal/15 bg-cream/30 px-3.5 py-2.5">
              <Search className="w-4 h-4 text-warm-grey shrink-0" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search restaurants or dishes..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="md:col-span-3 flex items-center gap-2 rounded-2xl border border-charcoal/15 bg-cream/30 px-3.5 py-2.5">
              <MapPin className="w-4 h-4 text-food-orange shrink-0" />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City (e.g. Bengaluru)"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full rounded-2xl bg-charcoal py-2.5 text-sm font-bold text-cream hover:bg-food-orange transition"
              >
                Search
              </button>
            </div>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-2xl border border-charcoal/15 py-2.5 text-sm font-semibold text-charcoal hover:bg-cream transition"
              >
                Reset
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-charcoal/10">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-warm-grey">
              <Filter className="w-3.5 h-3.5" /> Filters:
            </span>
            <select
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              className="rounded-full border border-charcoal/15 bg-cream/40 px-4 py-1.5 text-xs font-semibold outline-none"
            >
              <option value="">All Cuisines</option>
              {cuisines.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="rounded-full border border-charcoal/15 bg-cream/40 px-4 py-1.5 text-xs font-semibold outline-none"
            >
              <option value="">Any Rating</option>
              <option value="4.0">4.0★ & above</option>
              <option value="4.5">4.5★ & above</option>
            </select>
            <select
              value={maxTime}
              onChange={(e) => setMaxTime(e.target.value)}
              className="rounded-full border border-charcoal/15 bg-cream/40 px-4 py-1.5 text-xs font-semibold outline-none"
            >
              <option value="">Any Delivery Time</option>
              <option value="25">Under 25 mins</option>
              <option value="35">Under 35 mins</option>
            </select>
            <select
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="rounded-full border border-charcoal/15 bg-cream/40 px-4 py-1.5 text-xs font-semibold outline-none"
            >
              <option value="">Any Price for Two</option>
              <option value="600">Under ₹600</option>
              <option value="800">Under ₹800</option>
            </select>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-3xl bg-white/70 border border-charcoal/10" />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="rounded-3xl border border-charcoal/10 bg-white p-12 text-center space-y-3">
            <h3 className="font-display text-xl font-bold">No matching kitchens found</h3>
            <p className="text-sm text-charcoal/70">Try clearing one of your filters or searching another city.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((rest) => (
              <Link
                key={rest.id}
                to={`/restaurants/${rest.id}`}
                className="group overflow-hidden rounded-3xl border border-charcoal/10 bg-white transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-52 overflow-hidden">
                  <PhotoFrame
                    src={rest.image_url || rest.cover_image}
                    alt={rest.name}
                    className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                  />
                  <button
                    onClick={(e) => toggleFav(e, rest.id)}
                    aria-label="Toggle Favourite"
                    className="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-charcoal shadow hover:scale-110 transition"
                  >
                    <Heart
                      className={`w-4 h-4 ${rest.is_favourite ? "fill-food-orange text-food-orange" : "text-charcoal"}`}
                    />
                  </button>
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-charcoal/90 px-3 py-1 text-xs font-bold text-cream">
                    <Star className="w-3.5 h-3.5 fill-food-orange text-food-orange" />
                    {Number(rest.average_rating).toFixed(1)}
                  </div>
                  {!rest.is_open && (
                    <div className="absolute inset-0 bg-charcoal/60 flex items-center justify-center">
                      <span className="rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase text-charcoal">
                        Currently Closed
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-xl font-bold text-charcoal group-hover:text-food-orange transition">
                      {rest.name}
                    </h2>
                    <span className="text-xs font-semibold text-muted-olive shrink-0">
                      {rest.address?.city || "Bengaluru"}
                    </span>
                  </div>
                  <p className="text-xs text-charcoal/70 line-clamp-2">{rest.description}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-charcoal/10 text-xs font-semibold text-charcoal/80">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-food-orange" /> {rest.avg_delivery_time_mins} mins
                    </span>
                    <span>Delivery {formatINR(rest.delivery_fee)}</span>
                    <span>{formatINR(rest.price_for_two)} for two</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
