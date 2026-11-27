import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, Flame, Heart, Leaf, MapPin, Plus, ShoppingBag, Star } from "lucide-react";
import { api, extractApiError } from "../../lib/api";
import { formatINR } from "../../lib/format";
import { FoodCategory, FoodItem, Restaurant } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
import { PhotoFrame } from "../../components/ui/PhotoFrame";

interface ReviewItem {
  id: number;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export const RestaurantDetailPage: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToCart, itemCount } = useCart();
  const { showToast } = useToast();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [vegOnly, setVegOnly] = useState(false);
  const [selectedDish, setSelectedDish] = useState<FoodItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get<{ restaurant: Restaurant; categories: FoodCategory[]; items: FoodItem[] }>(`/restaurants/${id}/menu/`),
      api.get<{ results?: ReviewItem[] } | ReviewItem[]>(`/reviews/?restaurant=${id}`),
    ])
      .then(([menuRes, revRes]) => {
        setRestaurant(menuRes.data.restaurant);
        setCategories(menuRes.data.categories);
        setItems(menuRes.data.items);
        const rList = Array.isArray(revRes.data) ? revRes.data : revRes.data.results || [];
        setReviews(rList);
      })
      .catch((err) => {
        showToast(extractApiError(err, "Unable to load restaurant menu."), "error");
      })
      .finally(() => setLoading(false));
  }, [id, showToast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-charcoal border-t-food-orange" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="rounded-3xl bg-white p-10 text-center border border-charcoal/10">
          <h2 className="font-display text-2xl font-bold">Restaurant Unavailable</h2>
          <Link to="/restaurants" className="mt-4 inline-block text-sm font-bold text-food-orange underline">
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  const toggleFavourite = async () => {
    if (!restaurant) return;
    if (!user || user.role !== "CUSTOMER") {
      showToast("Log in as a customer to save favourite kitchens.", "warning");
      return;
    }
    try {
      const res = await api.post<{ is_favourite: boolean }>("/favourites/", { restaurant_id: restaurant.id });
      setRestaurant({ ...restaurant, is_favourite: res.data.is_favourite });
      showToast(res.data.is_favourite ? "Saved to favourites" : "Removed from favourites");
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const visibleItems = vegOnly ? items.filter((i) => i.is_vegetarian) : items;

  return (
    <div className="min-h-screen bg-cream pb-24">
      {/* Restaurant Hero Banner */}
      <div className="bg-charcoal text-cream border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 grid grid-cols-1 gap-8 lg:grid-cols-12 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-food-orange">
              <span>{restaurant.cuisines.map((c) => c.name).join(" • ")}</span>
              {!restaurant.is_open && (
                <span className="rounded-full bg-red-500/20 px-3 py-0.5 text-red-300">Closed</span>
              )}
            </div>
            <h1 className="font-display text-3xl font-extrabold sm:text-5xl">{restaurant.name}</h1>
            <p className="text-sm text-cream/75 max-w-2xl leading-relaxed">{restaurant.description}</p>
            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-semibold text-cream/85">
              <span className="flex items-center gap-1.5">
                <Star className="w-4 h-4 fill-food-orange text-food-orange" />
                {Number(restaurant.average_rating).toFixed(1)} ({restaurant.total_reviews} reviews)
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-food-orange" /> {restaurant.avg_delivery_time_mins} mins
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-food-orange" />
                {restaurant.address ? `${restaurant.address.street_address}, ${restaurant.address.city}` : "Bengaluru"}
              </span>
              <span>Min order {formatINR(restaurant.min_order_amount)}</span>
              <button
                type="button"
                onClick={toggleFavourite}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-1 text-xs font-bold hover:border-food-orange transition"
              >
                <Heart
                  className={`w-3.5 h-3.5 ${restaurant.is_favourite ? "fill-food-orange text-food-orange" : "text-cream"}`}
                />
                {restaurant.is_favourite ? "Saved" : "Save Kitchen"}
              </button>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
              <PhotoFrame src={restaurant.image_url || restaurant.cover_image} alt={restaurant.name} className="h-60 w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Menu Controls */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-charcoal/10 pb-5">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl font-extrabold">Menu</h2>
            <button
              onClick={() => setVegOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                vegOnly
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-charcoal/15 bg-white text-charcoal"
              }`}
            >
              <Leaf className="w-3.5 h-3.5" /> Veg Only
            </button>
          </div>
          {itemCount > 0 && (
            <Link
              to="/cart"
              className="inline-flex items-center gap-2 rounded-full bg-food-orange px-5 py-2.5 text-sm font-bold text-white shadow-lg"
            >
              <ShoppingBag className="w-4 h-4" /> View Cart ({itemCount})
            </Link>
          )}
        </div>

        {/* Grouped Menu Sections */}
        {categories.length === 0 && visibleItems.length === 0 ? (
          <p className="text-sm text-warm-grey">No dishes available right now.</p>
        ) : (
          <div className="space-y-10">
            {(categories.length > 0 ? categories : [{ id: 0, name: "All Dishes" } as FoodCategory]).map((cat) => {
              const catItems =
                cat.id === 0 ? visibleItems : visibleItems.filter((item) => item.category === cat.id);
              if (catItems.length === 0) return null;
              return (
                <div key={cat.id} className="space-y-4">
                  <h3 className="font-display text-xl font-bold text-charcoal">{cat.name}</h3>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {catItems.map((dish) => (
                      <div
                        key={dish.id}
                        className="flex gap-4 rounded-3xl border border-charcoal/10 bg-white p-4 transition hover:shadow-lg"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedDish(dish)}
                          className="shrink-0 overflow-hidden rounded-2xl w-28 h-28"
                        >
                          <PhotoFrame src={dish.image_url || dish.image} alt={dish.name} className="w-28 h-28" />
                        </button>
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block h-2.5 w-2.5 rounded-full ${
                                  dish.is_vegetarian ? "bg-emerald-600" : "bg-red-600"
                                }`}
                                title={dish.is_vegetarian ? "Vegetarian" : "Non-Vegetarian"}
                              />
                              <button
                                type="button"
                                onClick={() => setSelectedDish(dish)}
                                className="font-display text-base font-bold text-left hover:text-food-orange transition"
                              >
                                {dish.name}
                              </button>
                            </div>
                            <p className="mt-1 text-xs text-charcoal/70 line-clamp-2">{dish.description}</p>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                              <span className="font-display text-base font-extrabold text-charcoal">
                                {formatINR(dish.effective_price)}
                              </span>
                              {dish.discount_price && (
                                <span className="text-xs text-warm-grey line-through">{formatINR(dish.price)}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={!restaurant.is_open}
                              onClick={() => addToCart(dish.id, 1)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-charcoal px-4 py-2 text-xs font-bold text-cream hover:bg-food-orange transition disabled:opacity-40"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Customer Reviews */}
        <div className="pt-8 border-t border-charcoal/10 space-y-5">
          <h2 className="font-display text-2xl font-extrabold">Customer Reviews</h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-warm-grey">No reviews yet for this kitchen.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {reviews.map((rev) => (
                <div key={rev.id} className="rounded-3xl border border-charcoal/10 bg-white p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold">{rev.customer_name}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-0.5 text-xs font-bold">
                      <Star className="w-3 h-3 fill-food-orange text-food-orange" /> {rev.rating}
                    </span>
                  </div>
                  <p className="text-xs text-charcoal/75 leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Food Item Detail Modal */}
      {selectedDish && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-sm"
          onClick={() => setSelectedDish(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <PhotoFrame src={selectedDish.image_url || selectedDish.image} alt={selectedDish.name} className="h-56 w-full" />
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-2xl font-extrabold">{selectedDish.name}</h3>
                  <div className="mt-1 flex items-center gap-3 text-xs font-semibold text-warm-grey">
                    <span className="flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-food-orange" /> {selectedDish.spice_level}
                    </span>
                    <span>Prep ~{selectedDish.preparation_time_mins} mins</span>
                    {selectedDish.calories && <span>{selectedDish.calories} kcal</span>}
                  </div>
                </div>
                <span className="font-display text-xl font-extrabold text-charcoal">
                  {formatINR(selectedDish.effective_price)}
                </span>
              </div>
              <p className="text-sm text-charcoal/75 leading-relaxed">{selectedDish.description}</p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    await addToCart(selectedDish.id, 1);
                    setSelectedDish(null);
                  }}
                  className="flex-1 rounded-full bg-charcoal py-3 text-sm font-bold text-cream hover:bg-food-orange transition"
                >
                  Add to Cart — {formatINR(selectedDish.effective_price)}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDish(null)}
                  className="rounded-full border border-charcoal/15 px-5 py-3 text-sm font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
