import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Layers, Shield, Truck, Utensils } from "lucide-react";

export const HowItWorksPage: React.FC = () => (
  <div className="bg-cream py-16 px-4 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-5xl space-y-12">
      <div className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-food-orange">System Architecture</p>
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">How FoodFleet Connects Every Plate</h1>
        <p className="text-base text-charcoal/75 max-w-2xl">
          From verified restaurant onboarding to WebSocket order tracking and OpenStreetMap fleet routing, every role
          operates on a single synchronized state machine.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[
          { num: "01", title: "Browse & Filter Approved Kitchens", text: "Only Super Admin-verified restaurants appear in discovery, complete with live prep times and dietary filters." },
          { num: "02", title: "Smart Cart & Coupon Validation", text: "Single-kitchen cart protection, real-time item availability checks, GST computation, and promo verification." },
          { num: "03", title: "Kitchen Acceptance & Prep Queue", text: "Restaurants confirm prepaid/COD tickets, move orders to Preparing, and signal Ready for Pickup." },
          { num: "04", title: "Fleet Dispatch & Live Tracking", text: "Assigned partners pick up orders and stream real-time status milestones until doorstep completion." },
        ].map((s) => (
          <div key={s.num} className="rounded-3xl border border-charcoal/10 bg-white p-7 space-y-3">
            <span className="font-display text-3xl font-extrabold text-food-orange">{s.num}</span>
            <h2 className="font-display text-xl font-bold">{s.title}</h2>
            <p className="text-sm text-charcoal/75 leading-relaxed">{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const AboutUsPage: React.FC = () => (
  <div className="bg-cream py-16 px-4 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-5xl space-y-10">
      <div className="rounded-[2rem] bg-charcoal p-10 text-cream space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-food-orange">About FoodFleet</p>
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Your Cravings. Our Fleet.</h1>
        <p className="text-sm sm:text-base text-cream/75 max-w-2xl leading-relaxed">
          FoodFleet is built to give independent restaurants enterprise-grade delivery orchestration, fair fleet economics
          for riders, and crisp transparency for hungry customers.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          { icon: Shield, title: "Zero-Trust RBAC", desc: "Four isolated roles enforced across Django REST APIs, object ownership checks, and WebSocket channels." },
          { icon: Layers, title: "Immutable Ledger", desc: "Order items preserve exact dish names and purchase prices even if menus change later." },
          { icon: Utensils, title: "Editorial Craft", desc: "Designed around warm tactile clarity rather than noisy, cluttered marketplace feeds." },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.title} className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-3">
              <Icon className="w-6 h-6 text-food-orange" />
              <h3 className="font-display text-lg font-bold">{c.title}</h3>
              <p className="text-xs text-charcoal/70 leading-relaxed">{c.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export const PartnerPage: React.FC = () => (
  <div className="bg-cream py-16 px-4 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl space-y-12">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-food-orange">Partner With FoodFleet</p>
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Grow Your Kitchen or Fleet</h1>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-[2rem] bg-charcoal p-8 text-cream space-y-5">
          <Utensils className="w-8 h-8 text-food-orange" />
          <h2 className="font-display text-2xl font-extrabold">Restaurant Partners</h2>
          <ul className="space-y-2.5 text-sm text-cream/80">
            {["Dedicated menu & category builder", "Instant order acceptance & prep workflow", "Daily, weekly & best-seller Recharts analytics"].map((b) => (
              <li key={b} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-food-orange shrink-0" /> {b}
              </li>
            ))}
          </ul>
          <Link
            to="/register?role=RESTAURANT_OWNER"
            className="inline-flex items-center gap-2 rounded-full bg-food-orange px-6 py-3 text-sm font-bold text-white"
          >
            Onboard Restaurant <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="rounded-[2rem] border border-charcoal/15 bg-white p-8 space-y-5">
          <Truck className="w-8 h-8 text-muted-olive" />
          <h2 className="font-display text-2xl font-extrabold">Delivery Partners</h2>
          <ul className="space-y-2.5 text-sm text-charcoal/80">
            {["One-tap Available / Offline toggle", "OpenStreetMap pickup & drop-off routing", "Real-time earnings & delivery history ledger"].map((b) => (
              <li key={b} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-muted-olive shrink-0" /> {b}
              </li>
            ))}
          </ul>
          <Link
            to="/register?role=DELIVERY_PARTNER"
            className="inline-flex items-center gap-2 rounded-full bg-charcoal px-6 py-3 text-sm font-bold text-cream"
          >
            Become a Rider <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  </div>
);
