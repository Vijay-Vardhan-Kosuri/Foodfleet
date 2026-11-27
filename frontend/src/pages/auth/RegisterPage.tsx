import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { extractApiError } from "../../lib/api";
import { getRoleHomeRoute } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const registerSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters"),
  last_name: z.string().optional(),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(8, "Enter a valid phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["CUSTOMER", "RESTAURANT_OWNER", "DELIVERY_PARTNER"]),
  vehicle_type: z.string().optional(),
  vehicle_number: z.string().optional(),
  license_number: z.string().optional(),
});

type RegisterValues = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role");
  const defaultRole: "CUSTOMER" | "RESTAURANT_OWNER" | "DELIVERY_PARTNER" =
    initialRole === "RESTAURANT_OWNER" || initialRole === "DELIVERY_PARTNER" ? initialRole : "CUSTOMER";

  const { register: registerAccount } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: defaultRole, vehicle_type: "Motorbike" },
  });

  const selectedRole = watch("role");

  const onSubmit = async (values: RegisterValues) => {
    setSubmitting(true);
    try {
      const user = await registerAccount(values);
      showToast("Account created successfully!");
      navigate(getRoleHomeRoute(user.role), { replace: true });
    } catch (err) {
      showToast(extractApiError(err, "Registration failed."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] bg-cream py-14 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-[2rem] border border-charcoal/10 bg-white p-8 sm:p-10 shadow-xl shadow-charcoal/5">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-widest text-food-orange">Join FoodFleet</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-charcoal">Create Your Account</h1>
          <p className="mt-1.5 text-sm text-charcoal/70">
            Select your primary role to get started with FoodFleet.
          </p>
        </div>

        {/* Role Selector Pills */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {[
            { value: "CUSTOMER", label: "Customer" },
            { value: "RESTAURANT_OWNER", label: "Restaurant" },
            { value: "DELIVERY_PARTNER", label: "Delivery Fleet" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue("role", opt.value as RegisterValues["role"])}
              className={`rounded-2xl border py-3 text-xs font-bold transition ${
                selectedRole === opt.value
                  ? "border-charcoal bg-charcoal text-cream"
                  : "border-charcoal/15 bg-cream/40 text-charcoal hover:border-food-orange"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/75 mb-1">
                First Name
              </label>
              <input
                {...register("first_name")}
                className="w-full rounded-xl border border-charcoal/15 bg-cream/30 px-4 py-2.5 text-sm outline-none focus:border-food-orange"
              />
              {errors.first_name && <p className="mt-1 text-xs text-red-600">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/75 mb-1">
                Last Name
              </label>
              <input
                {...register("last_name")}
                className="w-full rounded-xl border border-charcoal/15 bg-cream/30 px-4 py-2.5 text-sm outline-none focus:border-food-orange"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/75 mb-1">
                Email Address
              </label>
              <input
                type="email"
                {...register("email")}
                className="w-full rounded-xl border border-charcoal/15 bg-cream/30 px-4 py-2.5 text-sm outline-none focus:border-food-orange"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/75 mb-1">
                Phone Number
              </label>
              <input
                {...register("phone")}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-charcoal/15 bg-cream/30 px-4 py-2.5 text-sm outline-none focus:border-food-orange"
              />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/75 mb-1">
              Password (min 8 characters)
            </label>
            <input
              type="password"
              {...register("password")}
              className="w-full rounded-xl border border-charcoal/15 bg-cream/30 px-4 py-2.5 text-sm outline-none focus:border-food-orange"
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>

          {selectedRole === "DELIVERY_PARTNER" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-2xl bg-cream/60 p-4 border border-charcoal/10">
              <div>
                <label className="block text-xs font-bold text-charcoal/75 mb-1">Vehicle Type</label>
                <input
                  {...register("vehicle_type")}
                  className="w-full rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-charcoal/75 mb-1">Vehicle Number</label>
                <input
                  {...register("vehicle_number")}
                  placeholder="KA-01-AB-1234"
                  className="w-full rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-charcoal/75 mb-1">License No.</label>
                <input
                  {...register("license_number")}
                  placeholder="DL-KA01-..."
                  className="w-full rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-charcoal py-3.5 text-sm font-bold text-cream hover:bg-food-orange transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating account..." : "Create Account"} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-charcoal/75">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-food-orange hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
