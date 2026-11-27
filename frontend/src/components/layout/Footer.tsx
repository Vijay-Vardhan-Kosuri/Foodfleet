import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-charcoal text-cream border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-food-orange text-white font-display font-extrabold">
                FF
              </div>
              <div>
                <h3 className="font-display text-xl font-extrabold tracking-tight">FoodFleet</h3>
                <p className="text-xs uppercase tracking-widest text-warm-grey">Your Cravings. Our Fleet.</p>
              </div>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-cream/70">
              A connected culinary and last-mile logistics platform empowering independent kitchens, local fleets,
              and food lovers with transparent, real-time delivery intelligence.
            </p>
            <div className="space-y-2 text-xs text-cream/65">
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-food-orange" /> 100 Feet Road, Indiranagar, Bengaluru 560038
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-food-orange" /> support@foodfleet.dev
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-food-orange" /> +91 80 4000 2026
              </p>
            </div>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-warm-grey">Platform</h4>
            <ul className="space-y-2.5 text-sm text-cream/80">
              <li><Link to="/" className="hover:text-food-orange transition">Home</Link></li>
              <li><Link to="/restaurants" className="hover:text-food-orange transition">Explore Restaurants</Link></li>
              <li><Link to="/how-it-works" className="hover:text-food-orange transition">How It Works</Link></li>
              <li><Link to="/about" className="hover:text-food-orange transition">About Us</Link></li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-warm-grey">Partner With Us</h4>
            <ul className="space-y-2.5 text-sm text-cream/80">
              <li><Link to="/partner" className="hover:text-food-orange transition">Restaurant Onboarding</Link></li>
              <li><Link to="/register?role=DELIVERY_PARTNER" className="hover:text-food-orange transition">Ride With FoodFleet</Link></li>
              <li><Link to="/login" className="hover:text-food-orange transition">Partner Portal</Link></li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-warm-grey">Get Started</h4>
            <p className="text-sm text-cream/70">
              Ready to experience restaurant-grade delivery orchestration?
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-food-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-white hover:text-charcoal transition"
            >
              Create Account <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-warm-grey sm:flex-row">
          <p>© {new Date().getFullYear()} FoodFleet Technologies. All rights reserved.</p>
          <p>Built with strict RBAC, Django Channels & React TypeScript.</p>
        </div>
      </div>
    </footer>
  );
};
