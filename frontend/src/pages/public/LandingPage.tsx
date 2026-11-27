import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Clock,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Truck,
  Zap,
} from "lucide-react";
import { api } from "../../lib/api";
import { formatINR } from "../../lib/format";
import { CuisineCategory, Restaurant } from "../../types";
import { PhotoFrame } from "../../components/ui/PhotoFrame";

const HOW_IT_WORKS_STEPS = [
  {
    num: "01",
    title: "Discover Curated Kitchens",
    desc: "Search approved neighborhood restaurants, filter by cuisine, rating, delivery speed, and dietary preference.",
  },
  {
    num: "02",
    title: "Build Your Cart Transparently",
    desc: "Add dishes with real-time availability checks, clear GST taxes, delivery fees, and instant coupon validation.",
  },
  {
    num: "03",
    title: "Verified Checkout & Kitchen Sync",
    desc: "Pay securely via Razorpay test mode or UPI. Approved kitchens receive and confirm your ticket instantly.",
  },
  {
    num: "04",
    title: "Dedicated Fleet Dispatch",
    desc: "Verified delivery partners accept the pickup, update arrival at the kitchen, and broadcast route milestones.",
  },
  {
    num: "05",
    title: "Live Tracking to Your Door",
    desc: "Follow every stage over WebSockets from preparation to doorstep delivery, then rate your meal.",
  },
];

const WHY_FOODFLEET = [
  {
    icon: ShieldCheck,
    title: "Verified Culinary Standards",
    desc: "Every kitchen passes multi-stage admin verification before accepting a single customer order.",
  },
  {
    icon: Zap,
    title: "Real-Time WebSocket Telemetry",
    desc: "Zero guesswork. Watch orders transition live across kitchen prep, pickup, and doorstep arrival.",
  },
  {
    icon: Truck,
    title: "Fair Fleet Economics",
    desc: "Transparent per-trip payouts and flexible availability toggles built for independent delivery partners.",
  },
  {
    icon: Store,
    title: "Operator-Grade Kitchen Tools",
    desc: "Live revenue analytics, menu toggling, and order queues tailored for busy restaurant teams.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "FoodFleet feels refreshingly intentional. Our pizzas arrive hot, and the live kitchen-to-door timeline is accurate down to the minute.",
    author: "Meenakshi Iyer",
    role: "Bengaluru Customer",
  },
  {
    quote:
      "Switching our kitchen onto FoodFleet cut order confusion to zero. The dashboard gives our staff instant clarity during dinner rush.",
    author: "Vikram Kapoor",
    role: "Founder, Forno & Hearth",
  },
  {
    quote:
      "Transparent earnings and clean OpenStreetMap pickup routes make every shift predictable and stress-free.",
    author: "Rohan Verma",
    role: "FoodFleet Delivery Partner",
  },
];

const FAQS = [
  {
    q: "How does FoodFleet verify restaurants before they go live?",
    a: "Every restaurant registration enters a Super Admin approval queue where business details, address coordinates, and hygiene credentials are reviewed before customers can order.",
  },
  {
    q: "How does real-time order tracking work?",
    a: "FoodFleet connects your order view to a dedicated Django Channels WebSocket stream with automatic polling fallback so status transitions update immediately.",
  },
  {
    q: "What happens if a paid order is cancelled or rejected?",
    a: "Our centralized order engine automatically creates a refund record for eligible cancellations or restaurant rejections, which administrators process with full audit logging.",
  },
  {
    q: "Can I join FoodFleet as both a restaurant and a delivery partner?",
    a: "Each FoodFleet account enforces a single primary role for strict RBAC security. You can register separate dedicated partner accounts for kitchen operations or fleet deliveries.",
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("Bengaluru");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [cuisines, setCuisines] = useState<CuisineCategory[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    api
      .get<{ results?: Restaurant[] } | Restaurant[]>("/restaurants/?featured=true")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data.results || [];
        setRestaurants(list.slice(0, 4));
      })
      .catch(() => {});

    api
      .get<CuisineCategory[]>("/cuisines/")
      .then((res) => setCuisines(Array.isArray(res.data) ? res.data.slice(0, 6) : []))
      .catch(() => {});
  }, []);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (cityQuery.trim()) params.set("city", cityQuery.trim());
    navigate(`/restaurants?${params.toString()}`);
  };

  return (
    <div className="bg-cream text-charcoal">
      {/* 1 & 2. Premium Editorial Hero + Supporting Description & Search */}
      <section className="relative overflow-hidden border-b border-charcoal/10 pt-14 pb-20 lg:pt-20 lg:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-7 reveal-fade">
              <div className="inline-flex items-center gap-2 rounded-full border border-charcoal/15 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-charcoal">
                <Sparkles className="w-3.5 h-3.5 text-food-orange" />
                Your Cravings. Our Fleet.
              </div>
              <h1 className="font-display text-4xl font-extrabold leading-[1.03] tracking-tight text-charcoal sm:text-6xl lg:text-7xl">
                Good Food.
                <br />
                <span className="text-food-orange">Smarter</span> Delivery.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-charcoal/75 sm:text-lg">
                An integrated culinary and last-mile logistics platform connecting discerning diners, independent
                restaurants, and verified delivery fleets in real time.
              </p>

              {/* Search Bar */}
              <form
                onSubmit={handleHeroSearch}
                className="flex flex-col gap-2.5 rounded-3xl border border-charcoal/15 bg-white p-2.5 shadow-xl shadow-charcoal/5 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-2.5 px-3 py-2 sm:w-44 border-b sm:border-b-0 sm:border-r border-charcoal/10">
                  <MapPin className="w-4 h-4 text-food-orange shrink-0" />
                  <input
                    type="text"
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    placeholder="City"
                    className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-warm-grey"
                  />
                </div>
                <div className="flex flex-1 items-center gap-2.5 px-3 py-2">
                  <Search className="w-4 h-4 text-warm-grey shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search restaurants, wood-fired pizza, biryani..."
                    className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-warm-grey"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-charcoal px-6 py-3.5 text-sm font-bold text-cream hover:bg-food-orange transition-colors"
                >
                  Explore Food <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-8 pt-2 text-xs font-semibold text-charcoal/70">
                <div>
                  <span className="block font-display text-2xl font-extrabold text-charcoal">25 min</span>
                  Avg Dispatch Time
                </div>
                <div className="h-8 w-px bg-charcoal/15" />
                <div>
                  <span className="block font-display text-2xl font-extrabold text-charcoal">100%</span>
                  Verified Kitchens
                </div>
                <div className="h-8 w-px bg-charcoal/15" />
                <div>
                  <span className="block font-display text-2xl font-extrabold text-charcoal">Live WS</span>
                  Order Telemetry
                </div>
              </div>
            </div>

            {/* Editorial Visual Composition */}
            <div className="lg:col-span-5 relative">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4 pt-8">
                  <div className="overflow-hidden rounded-3xl border border-charcoal/10 bg-white shadow-lg">
                    <PhotoFrame
                      src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80"
                      alt="Artisan Wood-Fired Pizza"
                      className="h-56 w-full"
                    />
                  </div>
                  <div className="rounded-3xl bg-charcoal p-5 text-cream">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-food-orange">
                      Live Dispatch Engine
                    </p>
                    <p className="mt-1.5 font-display text-lg font-bold leading-snug">
                      Seamless kitchen-to-rider handoff.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-3xl bg-muted-olive p-5 text-white">
                    <p className="text-[11px] font-bold uppercase tracking-widest opacity-85">Curated Quality</p>
                    <p className="mt-1.5 font-display text-2xl font-extrabold">4.8 ★</p>
                    <p className="text-xs opacity-90">Average diner satisfaction across approved kitchens</p>
                  </div>
                  <div className="overflow-hidden rounded-3xl border border-charcoal/10 bg-white shadow-lg">
                    <PhotoFrame
                      src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80"
                      alt="Gourmet Smash Burger"
                      className="h-64 w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured Restaurant Showcase */}
      <section className="py-20 border-b border-charcoal/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end mb-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-food-orange">Curated Selection</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Featured Kitchens on FoodFleet
              </h2>
            </div>
            <Link
              to="/restaurants"
              className="inline-flex items-center gap-2 text-sm font-bold text-charcoal hover:text-food-orange transition"
            >
              View All Restaurants <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {restaurants.map((rest) => (
              <Link
                key={rest.id}
                to={`/restaurants/${rest.id}`}
                className="group overflow-hidden rounded-3xl border border-charcoal/10 bg-white transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-48 overflow-hidden">
                  <PhotoFrame
                    src={rest.image_url || rest.cover_image}
                    alt={rest.name}
                    className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-charcoal/90 px-2.5 py-1 text-xs font-bold text-cream">
                    <Star className="w-3.5 h-3.5 fill-food-orange text-food-orange" />
                    {Number(rest.average_rating).toFixed(1)}
                  </div>
                </div>
                <div className="p-5 space-y-2.5">
                  <h3 className="font-display text-lg font-bold text-charcoal group-hover:text-food-orange transition">
                    {rest.name}
                  </h3>
                  <p className="text-xs text-warm-grey line-clamp-1">
                    {rest.cuisines.map((c) => c.name).join(" • ") || "Multi-Cuisine"}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-charcoal/10 text-xs font-semibold text-charcoal/75">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-food-orange" /> {rest.avg_delivery_time_mins} mins
                    </span>
                    <span>{formatINR(rest.price_for_two)} for two</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Popular Cuisines & Food Categories */}
      <section className="py-20 bg-white border-b border-charcoal/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-olive">Explore by Craft</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Popular Cuisines & Categories
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {cuisines.map((c) => (
              <Link
                key={c.id}
                to={`/restaurants?cuisine=${encodeURIComponent(c.slug)}`}
                className="group rounded-3xl border border-charcoal/10 bg-cream/60 p-3 text-center transition hover:border-food-orange hover:bg-white"
              >
                <div className="overflow-hidden rounded-2xl mb-3">
                  <PhotoFrame
                    src={c.image_url}
                    alt={c.name}
                    className="h-28 w-full transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <p className="font-display text-sm font-bold text-charcoal">{c.name}</p>
                <p className="text-[11px] text-warm-grey mt-0.5">{c.restaurant_count} kitchens</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 5. How FoodFleet Works – Five Numbered Steps */}
      <section className="py-24 bg-charcoal text-cream">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-food-orange">Orchestrated Flow</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
              How FoodFleet Works
            </h2>
            <p className="mt-4 text-sm text-cream/70 sm:text-base">
              Five synchronized steps uniting customer checkout, kitchen preparation, and fleet logistics.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div
                key={step.num}
                className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-food-orange/60"
              >
                <div>
                  <span className="font-display text-3xl font-extrabold text-food-orange">{step.num}</span>
                  <h3 className="mt-4 font-display text-lg font-bold leading-snug">{step.title}</h3>
                  <p className="mt-2.5 text-xs leading-relaxed text-cream/70">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Why Choose FoodFleet */}
      <section className="py-20 border-b border-charcoal/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-food-orange">Built Differently</p>
              <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Why Choose FoodFleet Over Generic Delivery Apps?
              </h2>
              <p className="text-sm leading-relaxed text-charcoal/75">
                Every workflow in FoodFleet is engineered for accountability—from immutable order price snapshots to
                strict role-based boundaries across diners, kitchens, riders, and platform operations.
              </p>
            </div>
            <div className="lg:col-span-7 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {WHY_FOODFLEET.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream text-food-orange">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-display text-lg font-bold">{item.title}</h3>
                    <p className="text-xs leading-relaxed text-charcoal/70">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 7 & 8. Restaurant Partner & Delivery Partner Promotional Sections */}
      <section className="py-20 bg-white border-b border-charcoal/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Restaurant Partner Promo */}
          <div className="flex flex-col justify-between rounded-[2rem] bg-charcoal p-8 text-cream sm:p-10">
            <div className="space-y-4">
              <span className="inline-block rounded-full bg-food-orange/20 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-food-orange">
                For Restaurants
              </span>
              <h3 className="font-display text-3xl font-extrabold leading-tight">
                Scale Your Kitchen Without Losing Margin or Control.
              </h3>
              <p className="text-sm text-cream/75 leading-relaxed">
                Manage menus, operating hours, live order queues, and revenue analytics from one crisp operator console.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register?role=RESTAURANT_OWNER"
                className="inline-flex items-center gap-2 rounded-full bg-food-orange px-6 py-3 text-sm font-bold text-white hover:bg-white hover:text-charcoal transition"
              >
                Register Your Restaurant <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/partner"
                className="inline-flex items-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-cream hover:border-white transition"
              >
                Learn More
              </Link>
            </div>
          </div>

          {/* Delivery Partner Promo */}
          <div className="flex flex-col justify-between rounded-[2rem] border border-charcoal/15 bg-cream p-8 text-charcoal sm:p-10">
            <div className="space-y-4">
              <span className="inline-block rounded-full bg-muted-olive/20 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-muted-olive">
                For Delivery Fleet
              </span>
              <h3 className="font-display text-3xl font-extrabold leading-tight">
                Drive on Your Schedule. Track Every Rupee Earned.
              </h3>
              <p className="text-sm text-charcoal/75 leading-relaxed">
                Toggle availability anytime, accept verified pickups with interactive OpenStreetMap routing, and view
                daily and weekly earnings instantly.
              </p>
            </div>
            <div className="mt-8">
              <Link
                to="/register?role=DELIVERY_PARTNER"
                className="inline-flex items-center gap-2 rounded-full bg-charcoal px-6 py-3 text-sm font-bold text-cream hover:bg-food-orange transition"
              >
                Join the Delivery Fleet <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Customer Testimonials */}
      <section className="py-20 border-b border-charcoal/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-food-orange">Voices Across the Fleet</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Trusted by Diners, Kitchens & Riders
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.author} className="flex flex-col justify-between rounded-3xl border border-charcoal/10 bg-white p-7">
                <p className="text-sm leading-relaxed text-charcoal/85">“{t.quote}”</p>
                <div className="mt-6 pt-4 border-t border-charcoal/10">
                  <p className="font-display text-sm font-bold text-charcoal">{t.author}</p>
                  <p className="text-xs text-warm-grey">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. Frequently Asked Questions */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-food-orange">FAQ</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={faq.q} className="rounded-2xl border border-charcoal/10 bg-cream/40 overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left font-display text-sm font-bold sm:text-base"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && <p className="px-6 pb-5 text-sm leading-relaxed text-charcoal/75">{faq.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
