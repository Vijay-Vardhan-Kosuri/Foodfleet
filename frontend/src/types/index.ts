export type UserRole = "SUPER_ADMIN" | "CUSTOMER" | "RESTAURANT_OWNER" | "DELIVERY_PARTNER";

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  is_suspended: boolean;
  avatar?: string | null;
  restaurant_id?: number | null;
  restaurant_approval_status?: string | null;
  customer_profile?: {
    id: number;
    default_city: string;
    dietary_preference: string;
    loyalty_points: number;
  };
  delivery_profile?: DeliveryPartnerProfile;
  created_at: string;
}

export interface DeliveryPartnerProfile {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  license_number: string;
  verification_status: "PENDING" | "VERIFIED" | "REJECTED";
  availability_status: "AVAILABLE" | "BUSY" | "OFFLINE";
  current_lat: string;
  current_lng: string;
  total_deliveries: number;
  rating_avg: string;
  id_document?: string | null;
  license_document?: string | null;
}

export interface Address {
  id: number;
  label: string;
  street_address: string;
  apartment: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: string;
  longitude: string;
  is_default: boolean;
}

export interface CuisineCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  is_active: boolean;
  restaurant_count: number;
}

export interface OperatingHours {
  id: number;
  day_of_week: number;
  day_name: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface Restaurant {
  id: number;
  owner: number;
  owner_email: string;
  owner_name: string;
  name: string;
  slug: string;
  description: string;
  cuisines: CuisineCategory[];
  phone: string;
  email: string;
  logo?: string | null;
  cover_image?: string | null;
  image_url: string;
  approval_status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  rejection_reason: string;
  is_open: boolean;
  is_featured: boolean;
  average_rating: string;
  total_reviews: number;
  avg_delivery_time_mins: number;
  delivery_fee: string;
  min_order_amount: string;
  price_for_two: string;
  commission_rate: string;
  is_favourite: boolean;
  address?: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
    latitude: string;
    longitude: string;
  } | null;
  operating_hours?: OperatingHours[];
}

export interface FoodCategory {
  id: number;
  restaurant: number;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export interface FoodItem {
  id: number;
  restaurant: number;
  restaurant_name: string;
  category: number | null;
  category_name: string;
  name: string;
  description: string;
  price: string;
  discount_price: string | null;
  effective_price: string;
  image?: string | null;
  image_url: string;
  is_vegetarian: boolean;
  is_available: boolean;
  preparation_time_mins: number;
  calories?: number | null;
  spice_level: string;
  order_count: number;
}

export interface CartItem {
  id: number;
  food_item: number;
  food_name: string;
  unit_price: string;
  quantity: number;
  line_total: string;
  is_available: boolean;
  is_vegetarian: boolean;
  image_url: string;
}

export interface Cart {
  id: number;
  restaurant: number | null;
  restaurant_name: string;
  coupon_code: string;
  items: CartItem[];
  totals: {
    subtotal: string;
    tax_amount: string;
    delivery_fee: string;
    discount_amount: string;
    total_amount: string;
    unavailable_items: string[];
    coupon_error: string;
  };
}

export type OrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED"
  | "PAYMENT_FAILED"
  | "REFUND_PENDING"
  | "REFUNDED";

export interface Order {
  id: number;
  order_number: string;
  customer: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  restaurant: number;
  restaurant_name: string;
  restaurant_phone: string;
  restaurant_address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
    latitude: string;
    longitude: string;
  } | null;
  status: OrderStatus;
  payment_status: string;
  payment_method: string;
  subtotal: string;
  tax_amount: string;
  delivery_fee: string;
  discount_amount: string;
  total_amount: string;
  platform_commission: string;
  restaurant_payout: string;
  delivery_address_snapshot: {
    label?: string;
    street_address?: string;
    apartment?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
  delivery_lat: string;
  delivery_lng: string;
  special_instructions: string;
  coupon_code: string;
  rejection_reason: string;
  cancellation_reason: string;
  items: {
    id: number;
    food_item: number | null;
    food_name_snapshot: string;
    unit_price_snapshot: string;
    quantity: number;
    total_price: string;
  }[];
  status_history: {
    id: number;
    from_status: string;
    to_status: string;
    actor_role: string;
    changed_by_email: string;
    notes: string;
    created_at: string;
  }[];
  delivery_partner: {
    assignment_id: number;
    assignment_status: string;
    partner_id: number;
    name: string;
    phone: string;
    vehicle_type: string;
    vehicle_number: string;
    current_lat: string;
    current_lng: string;
  } | null;
  has_review: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryAssignment {
  id: number;
  order: number;
  order_number: string;
  order_status: OrderStatus;
  order_total: string;
  payment_method: string;
  delivery_partner: number | null;
  partner_name: string | null;
  status:
    | "ASSIGNED"
    | "ACCEPTED"
    | "ARRIVED_AT_RESTAURANT"
    | "PICKED_UP"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "REJECTED";
  delivery_fee_earned: string;
  restaurant_name: string;
  restaurant_phone: string;
  restaurant_address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
    latitude: string;
    longitude: string;
  } | null;
  customer_name: string;
  customer_phone: string;
  delivery_address: {
    label?: string;
    street_address?: string;
    apartment?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
  delivery_lat: string;
  delivery_lng: string;
  assigned_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  notes: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  related_order_id: number | null;
  is_read: boolean;
  created_at: string;
}
