import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  ShoppingBag,
  User as UserIcon,
  X,
} from "lucide-react";
import { api } from "../../lib/api";
import { getRoleHomeRoute } from "../../lib/format";
import { NotificationItem } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    api
      .get<{ results?: NotificationItem[] } | NotificationItem[]>("/notifications/")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data.results || [];
        setNotifications(list.slice(0, 8));
      })
      .catch(() => {});
  }, [user, location.pathname]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all/");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/restaurants", label: "Explore Restaurants" },
    { to: "/how-it-works", label: "How It Works" },
    { to: "/about", label: "About Us" },
    { to: "/partner", label: "Become a Partner" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-charcoal/10 bg-cream/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-charcoal text-cream font-display text-sm font-extrabold tracking-tight transition-transform group-hover:scale-105">
            FF
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg font-extrabold tracking-tight text-charcoal">FoodFleet</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-warm-grey">
              Your Cravings. Our Fleet.
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-7">
          {navLinks.map((item) => {
            if (user?.role === "DELIVERY_PARTNER" && item.to === "/restaurants") return null;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`text-sm font-medium transition-colors ${
                  active ? "text-food-orange" : "text-charcoal/80 hover:text-charcoal"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="hidden lg:flex items-center gap-3">
          {!user ? (
            <>
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-sm font-semibold text-charcoal hover:bg-charcoal/5 transition"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-charcoal px-5 py-2.5 text-sm font-semibold text-cream hover:bg-food-orange transition-colors"
              >
                Get Started
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              {user.role === "CUSTOMER" && (
                <Link
                  to="/cart"
                  className="relative flex items-center gap-2 rounded-full border border-charcoal/15 bg-white px-4 py-2 text-sm font-semibold text-charcoal hover:border-food-orange transition"
                >
                  <ShoppingBag className="w-4 h-4 text-food-orange" />
                  <span>Cart</span>
                  {itemCount > 0 && (
                    <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-food-orange px-1.5 text-[11px] font-bold text-white">
                      {itemCount}
                    </span>
                  )}
                </Link>
              )}

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen((o) => !o)}
                  aria-label="Notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-charcoal/15 bg-white text-charcoal hover:border-charcoal/40 transition"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-food-orange px-1 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-charcoal/10 bg-white p-4 shadow-2xl z-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-display text-sm font-bold">Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs font-semibold text-food-orange hover:underline">
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-xs text-warm-grey py-4 text-center">You're all caught up.</p>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`rounded-xl p-2.5 text-xs ${n.is_read ? "bg-cream/40" : "bg-food-orange/10"}`}
                          >
                            <p className="font-semibold text-charcoal">{n.title}</p>
                            <p className="text-charcoal/70 mt-0.5">{n.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Role Dashboard Link */}
              <Link
                to={user.role === "CUSTOMER" ? "/orders" : getRoleHomeRoute(user.role)}
                className="flex items-center gap-2 rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-cream hover:bg-food-orange transition"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{user.role === "CUSTOMER" ? "My Orders" : "Dashboard"}</span>
              </Link>

              {user.role === "CUSTOMER" && (
                <Link
                  to="/profile"
                  title="Profile & Addresses"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-charcoal/15 bg-white text-charcoal hover:border-charcoal/40"
                >
                  <UserIcon className="w-4 h-4" />
                </Link>
              )}

              <button
                onClick={handleLogout}
                title="Logout"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-charcoal/15 bg-white text-charcoal hover:border-red-400 hover:text-red-600 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-charcoal/15 bg-white"
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-charcoal/10 bg-cream px-4 py-4 space-y-3">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className="block py-2 text-sm font-semibold text-charcoal"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-charcoal/10 flex flex-col gap-2">
            {!user ? (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="w-full rounded-full border border-charcoal/20 py-2.5 text-center text-sm font-semibold"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="w-full rounded-full bg-charcoal py-2.5 text-center text-sm font-semibold text-cream"
                >
                  Get Started
                </Link>
              </>
            ) : (
              <>
                <Link
                  to={user.role === "CUSTOMER" ? "/orders" : getRoleHomeRoute(user.role)}
                  onClick={() => setMobileOpen(false)}
                  className="w-full rounded-full bg-charcoal py-2.5 text-center text-sm font-semibold text-cream"
                >
                  {user.role === "CUSTOMER" ? "My Orders" : "Dashboard"}
                </Link>
                {user.role === "CUSTOMER" && (
                  <Link
                    to="/cart"
                    onClick={() => setMobileOpen(false)}
                    className="w-full rounded-full border border-charcoal/20 py-2.5 text-center text-sm font-semibold"
                  >
                    Cart ({itemCount})
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="w-full rounded-full border border-red-300 py-2.5 text-center text-sm font-semibold text-red-700"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
