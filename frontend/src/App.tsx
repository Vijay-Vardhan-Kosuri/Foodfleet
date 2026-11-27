import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import { Navbar } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import { RoleGuard } from "./components/layout/RoleGuard";
import { LandingPage } from "./pages/public/LandingPage";
import { ExploreRestaurantsPage } from "./pages/public/ExploreRestaurantsPage";
import { RestaurantDetailPage } from "./pages/public/RestaurantDetailPage";
import { AboutUsPage, HowItWorksPage, PartnerPage } from "./pages/public/StaticInfoPages";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage, ResetPasswordPage } from "./pages/auth/PasswordResetPages";
import { CartPage } from "./pages/customer/CartPage";
import { CheckoutPage } from "./pages/customer/CheckoutPage";
import { OrderTrackingPage } from "./pages/customer/OrderTrackingPage";
import { OrderHistoryPage } from "./pages/customer/OrderHistoryPage";
import { CustomerProfilePage } from "./pages/customer/CustomerProfilePage";
import { RestaurantDashboardPage } from "./pages/restaurant/RestaurantDashboardPage";
import { DeliveryDashboardPage } from "./pages/delivery/DeliveryDashboardPage";
import { SuperAdminDashboardPage } from "./pages/admin/SuperAdminDashboardPage";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  {/* Public */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/restaurants" element={<ExploreRestaurantsPage />} />
                  <Route path="/restaurants/:id" element={<RestaurantDetailPage />} />
                  <Route path="/how-it-works" element={<HowItWorksPage />} />
                  <Route path="/about" element={<AboutUsPage />} />
                  <Route path="/partner" element={<PartnerPage />} />

                  {/* Auth */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />

                  {/* Customer */}
                  <Route
                    path="/cart"
                    element={
                      <RoleGuard allowedRoles={["CUSTOMER"]}>
                        <CartPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/checkout"
                    element={
                      <RoleGuard allowedRoles={["CUSTOMER"]}>
                        <CheckoutPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/orders"
                    element={
                      <RoleGuard allowedRoles={["CUSTOMER"]}>
                        <OrderHistoryPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/orders/:id"
                    element={
                      <RoleGuard allowedRoles={["CUSTOMER", "SUPER_ADMIN", "RESTAURANT_OWNER"]}>
                        <OrderTrackingPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <RoleGuard allowedRoles={["CUSTOMER"]}>
                        <CustomerProfilePage />
                      </RoleGuard>
                    }
                  />

                  {/* Restaurant Owner */}
                  <Route
                    path="/restaurant/dashboard"
                    element={
                      <RoleGuard allowedRoles={["RESTAURANT_OWNER"]}>
                        <RestaurantDashboardPage />
                      </RoleGuard>
                    }
                  />

                  {/* Delivery Partner */}
                  <Route
                    path="/delivery/dashboard"
                    element={
                      <RoleGuard allowedRoles={["DELIVERY_PARTNER"]}>
                        <DeliveryDashboardPage />
                      </RoleGuard>
                    }
                  />

                  {/* Super Admin */}
                  <Route
                    path="/admin/dashboard"
                    element={
                      <RoleGuard allowedRoles={["SUPER_ADMIN"]}>
                        <SuperAdminDashboardPage />
                      </RoleGuard>
                    }
                  />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
