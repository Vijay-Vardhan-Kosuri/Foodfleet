import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, extractApiError } from "../../lib/api";
import { useToast } from "../../context/ToastContext";

export const ForgotPasswordPage: React.FC = () => {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [devToken, setDevToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{ message: string; dev_reset_token?: string }>("/auth/forgot-password/", { email });
      showToast(res.data.message);
      if (res.data.dev_reset_token) {
        setDevToken(res.data.dev_reset_token);
      }
    } catch (err) {
      showToast(extractApiError(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] bg-cream py-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-[2rem] border border-charcoal/10 bg-white p-8 shadow-xl">
        <h1 className="font-display text-2xl font-extrabold">Forgot Password</h1>
        <p className="mt-1.5 text-sm text-charcoal/70">Enter your account email to generate a reset token.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@foodfleet.dev"
            className="w-full rounded-xl border border-charcoal/15 bg-cream/30 px-4 py-3 text-sm outline-none focus:border-food-orange"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-charcoal py-3 text-sm font-bold text-cream hover:bg-food-orange transition"
          >
            {loading ? "Requesting..." : "Send Reset Instructions"}
          </button>
        </form>
        {devToken && (
          <div className="mt-5 rounded-2xl border border-food-orange/30 bg-food-orange/10 p-4 text-xs">
            <p className="font-bold text-charcoal">Dev Reset Token:</p>
            <p className="mt-1 break-all font-mono text-charcoal/80">{devToken}</p>
            <Link
              to={`/reset-password?token=${encodeURIComponent(devToken)}`}
              className="mt-2 inline-block font-bold text-food-orange underline"
            >
              Proceed to Reset Password →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const { showToast } = useToast();
  const params = new URLSearchParams(window.location.search);
  const [token, setToken] = useState(params.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/auth/reset-password/", { token, new_password: newPassword });
      showToast("Password updated! Please log in.");
      setDone(true);
    } catch (err) {
      showToast(extractApiError(err, "Unable to reset password."), "error");
    }
  };

  return (
    <div className="min-h-[75vh] bg-cream py-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-[2rem] border border-charcoal/10 bg-white p-8 shadow-xl">
        <h1 className="font-display text-2xl font-extrabold">Reset Password</h1>
        {done ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-emerald-700">Your password has been reset successfully.</p>
            <Link
              to="/login"
              className="block w-full rounded-full bg-charcoal py-3 text-center text-sm font-bold text-cream"
            >
              Go to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Reset token"
              className="w-full rounded-xl border border-charcoal/15 bg-cream/30 px-4 py-3 text-sm"
            />
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              className="w-full rounded-xl border border-charcoal/15 bg-cream/30 px-4 py-3 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-charcoal py-3 text-sm font-bold text-cream hover:bg-food-orange transition"
            >
              Confirm New Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
