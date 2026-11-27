# FoodFleet REST & WebSocket API Documentation

Base URL: `/api/`  
Authentication: `Authorization: Bearer <access_token>` (JWT)

---

## Authentication (`/api/auth/`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register/` | Public | Register `CUSTOMER`, `RESTAURANT_OWNER`, or `DELIVERY_PARTNER` (`SUPER_ADMIN` blocked) |
| `POST` | `/api/auth/login/` | Public | Obtain JWT access/refresh tokens and user profile |
| `POST` | `/api/auth/refresh/` | Public | Rotate refresh token and issue new access token |
| `POST` | `/api/auth/logout/` | Authenticated | Blacklist refresh token |
| `GET/PATCH` | `/api/auth/profile/` | Authenticated | View or update own profile |
| `POST` | `/api/auth/forgot-password/` | Public | Generate password reset token |
| `POST` | `/api/auth/reset-password/` | Public | Reset password with valid token |
| `GET/POST/PATCH/DELETE` | `/api/auth/addresses/` | Customer | Manage customer delivery addresses |
| `GET/PATCH` | `/api/auth/delivery-profile/` | Delivery Partner | Update profile and upload verification documents |

---

## Restaurants & Menus (`/api/`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/cuisines/` | Public | List active cuisine categories |
| `GET` | `/api/restaurants/` | Public / Customer | List approved restaurants (filter by `cuisine`, `city`, `min_rating`, `max_delivery_time`, `max_price`, `featured`, `search`) |
| `GET` | `/api/restaurants/{id}/menu/` | Public / Customer | View approved restaurant details, categories, and available menu items (blocked for `DELIVERY_PARTNER`) |
| `POST` | `/api/restaurants/` | Restaurant Owner | Submit new restaurant (`approval_status=PENDING`) |
| `GET/PATCH` | `/api/restaurants/my/` | Restaurant Owner | Manage own restaurant profile |
| `GET/PUT` | `/api/restaurants/my/operating-hours/` | Restaurant Owner | Manage 7-day operating schedule |
| `GET` | `/api/restaurants/my/analytics/` | Restaurant Owner | Sales KPIs, daily revenue, best-selling items, status breakdown |
| `GET/POST/PATCH/DELETE` | `/api/food-categories/` | Restaurant Owner | Manage own menu categories |
| `GET/POST/PATCH/DELETE` | `/api/food/` | Public (read) / Owner (write) | Manage own food items |
| `GET/POST` | `/api/favourites/` | Customer | List or toggle favourite restaurants |

---

## Cart, Orders & Payments

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET/DELETE` | `/api/cart/` | Customer | View or clear cart |
| `POST` | `/api/cart/items/` | Customer | Add dish to cart (`replace_cart=true` switches restaurant) |
| `PATCH/DELETE` | `/api/cart/items/{id}/` | Customer | Update item quantity or remove item |
| `POST/DELETE` | `/api/cart/coupon/` | Customer | Apply or remove coupon |
| `POST` | `/api/orders/` | Customer | Create order from cart (idempotent via `idempotency_key`) |
| `GET` | `/api/orders/` | Role-scoped | Customer own orders / Owner restaurant orders / Rider assigned orders / Admin all |
| `GET` | `/api/orders/{id}/` | Object-scoped | Retrieve single order with items, history & rider info |
| `PATCH` | `/api/orders/{id}/status/` | Role-scoped | Transition order status following state machine |
| `POST` | `/api/payments/create/` | Customer | Initialize payment intent (Razorpay test or simulated) |
| `POST` | `/api/payments/verify/` | Customer | Verify payment signature/outcome |
| `GET` | `/api/payments/history/` | Customer / Owner / Admin | Scoped payment transaction ledger |

---

## Delivery Partner (`/api/delivery/`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/delivery/assignments/` | Delivery Partner | View assignments assigned to the authenticated partner |
| `POST` | `/api/delivery/assignments/{id}/accept/` | Delivery Partner | Accept assigned delivery |
| `POST` | `/api/delivery/assignments/{id}/reject/` | Delivery Partner | Decline assigned delivery |
| `PATCH` | `/api/delivery/assignments/{id}/status/` | Delivery Partner | Advance `ARRIVED_AT_RESTAURANT` → `PICKED_UP` → `OUT_FOR_DELIVERY` → `DELIVERED` |
| `POST` | `/api/delivery/availability/` | Delivery Partner | Toggle `AVAILABLE` / `BUSY` / `OFFLINE` |
| `GET` | `/api/delivery/earnings/` | Delivery Partner | Completed deliveries & daily/weekly earnings |

---

## Super Admin (`/api/admin/`)

All `/api/admin/*` endpoints strictly require `role == SUPER_ADMIN` and record sensitive actions in `AuditLog`:
- `/api/admin/dashboard/` & `/api/admin/analytics/`
- `/api/admin/users/` & `/api/admin/users/{id}/suspend/`
- `/api/admin/restaurants/` & `/api/admin/restaurants/{id}/approval/`
- `/api/admin/delivery-partners/` & `/api/admin/delivery-partners/{id}/verify/`
- `/api/admin/orders/` & `/api/admin/orders/{id}/assign-delivery/`
- `/api/admin/payments/`, `/api/admin/refunds/` & `/api/admin/refunds/{id}/process/`
- `/api/admin/coupons/` & `/api/admin/categories/`
- `/api/admin/reviews/{id}/moderate/` & `/api/admin/complaints/{id}/resolve/`
- `/api/admin/audit-logs/` & `/api/admin/config/`

---

## WebSockets (Django Channels)

- `ws://<host>/ws/orders/<order_id>/?token=<jwt_access_token>` — Live order status stream (authorized to order owner, restaurant owner, assigned rider, or Super Admin).
- `ws://<host>/ws/notifications/?token=<jwt_access_token>` — Real-time user notification stream.
