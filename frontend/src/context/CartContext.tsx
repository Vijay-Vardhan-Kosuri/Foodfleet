import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, extractApiError } from "../lib/api";
import { Cart } from "../types";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

interface CartContextValue {
  cart: Cart | null;
  itemCount: number;
  loading: boolean;
  refreshCart: () => Promise<void>;
  addToCart: (foodItemId: number, quantity?: number, replaceCart?: boolean) => Promise<boolean>;
  updateQuantity: (cartItemId: number, quantity: number) => Promise<void>;
  removeItem: (cartItemId: number) => Promise<void>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue>({
  cart: null,
  itemCount: 0,
  loading: false,
  refreshCart: async () => {},
  addToCart: async () => false,
  updateQuantity: async () => {},
  removeItem: async () => {},
  applyCoupon: async () => false,
  removeCoupon: async () => {},
  clearCart: async () => {},
});

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!user || user.role !== "CUSTOMER") {
      setCart(null);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<Cart>("/cart/");
      setCart(res.data);
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = async (foodItemId: number, quantity = 1, replaceCart = false): Promise<boolean> => {
    if (!user) {
      showToast("Please log in as a customer to add items to your cart.", "warning");
      return false;
    }
    if (user.role !== "CUSTOMER") {
      showToast("Only customer accounts can place orders.", "warning");
      return false;
    }
    try {
      const res = await api.post<Cart>("/cart/items/", {
        food_item_id: foodItemId,
        quantity,
        replace_cart: replaceCart,
      });
      setCart(res.data);
      showToast("Added to cart");
      return true;
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number; data?: { code?: string; message?: string } } };
      if (anyErr?.response?.status === 409 && anyErr?.response?.data?.code === "DIFFERENT_RESTAURANT") {
        const confirmReplace = window.confirm(anyErr.response.data.message || "Replace cart items from previous restaurant?");
        if (confirmReplace) {
          return addToCart(foodItemId, quantity, true);
        }
        return false;
      }
      showToast(extractApiError(err, "Unable to add item to cart."), "error");
      return false;
    }
  };

  const updateQuantity = async (cartItemId: number, quantity: number) => {
    try {
      const res = await api.patch<Cart>(`/cart/items/${cartItemId}/`, { quantity });
      setCart(res.data);
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const removeItem = async (cartItemId: number) => {
    try {
      const res = await api.delete<Cart>(`/cart/items/${cartItemId}/`);
      setCart(res.data);
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const applyCoupon = async (code: string): Promise<boolean> => {
    try {
      const res = await api.post<Cart>("/cart/coupon/", { code });
      setCart(res.data);
      showToast(`Coupon ${code.toUpperCase()} applied!`);
      return true;
    } catch (err) {
      showToast(extractApiError(err, "Invalid coupon code."), "error");
      return false;
    }
  };

  const removeCoupon = async () => {
    try {
      const res = await api.delete<Cart>("/cart/coupon/");
      setCart(res.data);
      showToast("Coupon removed");
    } catch (err) {
      showToast(extractApiError(err), "error");
    }
  };

  const clearCart = async () => {
    try {
      const res = await api.delete<Cart>("/cart/");
      setCart(res.data);
    } catch {
      // ignore
    }
  };

  const itemCount = cart?.items?.reduce((acc, item) => acc + item.quantity, 0) ?? 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount,
        loading,
        refreshCart,
        addToCart,
        updateQuantity,
        removeItem,
        applyCoupon,
        removeCoupon,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
