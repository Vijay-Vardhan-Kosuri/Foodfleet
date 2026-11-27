import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, KeyRound, Lock, Mail } from "lucide-react";
import { api, extractApiError } from "../../lib/api";
import { getRoleHomeRoute } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface DemoAccount {
  role: string;
  email: string;
  password: string;
}

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    api
      .get<{ demo_accounts: DemoAccount[] }>("/auth/demo-accounts/")
      .then((res) => setDemoAccounts(res.data.demo_accounts || []))
      .catch(() => {});
  }, []);

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      const user = await login(values.email, values.password);
      showToast(`Welcome back, ${user.first_name || user.username}!`);
      navigate(getRoleHomeRoute(user.role), { replace: true });
    } catch (err) {
      showToast(extractApiError(err, "Invalid email or password."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (acc: DemoAccount) => {
    setValue("email", acc.email);
    setValue("password", acc.password);
  };

  return (
    <div className="min-h-[82vh] bg-cream py-14 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-5xl grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-[2rem] border border-charcoal/10 bg-white p-8 sm:p-10 shadow-xl shadow-charcoal/5">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-food-orange">Account Access</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold text-charcoal">Sign in to FoodFleet</h1>
            <p className="mt-1.5 text-sm text-charcoal/70">
              Role-aware access for customers, restaurant operators, delivery partners, and administrators.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/75 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-warm-grey absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  {...register("email")}
                  placeholder="you@foodfleet.dev"
                  className="w-full rounded-xl border border-charcoal/15 bg-cream/30 pl-10 pr-4 py-3 text-sm outline-none focus:border-food-orange"
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/75">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-food-orange hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-warm-grey absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  {...register("password")}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-charcoal/15 bg-cream/30 pl-10 pr-4 py-3 text-sm outline-none focus:border-food-orange"
                />
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-charcoal py-3.5 text-sm font-bold text-cream hover:bg-food-orange transition-colors disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign In"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-charcoal/75">
            New to FoodFleet?{" "}
            <Link to="/register" className="font-bold text-food-orange hover:underline">
              Create an account
            </Link>
          </p>
        </div>

        {/* Dev-only demo accounts panel */}
        <div className="lg:col-span-5 rounded-[2rem] bg-charcoal p-8 text-cream flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-food-orange">
              <KeyRound className="w-3.5 h-3.5" /> Development Mode
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold">Quick Role Preview</h2>
            <p className="mt-2 text-xs leading-relaxed text-cream/70">
              Available in development mode only. Click any role below to populate credentials and test FoodFleet's
              end-to-end RBAC boundaries.
            </p>

            <div className="mt-6 space-y-2.5">
              {demoAccounts.length === 0 ? (
                <p className="text-xs text-warm-grey">Demo accounts disabled in this environment.</p>
              ) : (
                demoAccounts.map((acc) => (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => fillDemo(acc)}
                    className="w-full flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:border-food-orange transition"
                  >
                    <div>
                      <p className="text-xs font-bold text-food-orange">{acc.role.replace("_", " ")}</p>
                      <p className="text-xs text-cream/85">{acc.email}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-cream/60">Use</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <p className="mt-8 text-[11px] text-warm-grey">
            Every role permission is strictly enforced server-side by Django REST Framework.
          </p>
        </div>
      </div>
    </div>
  );
};
