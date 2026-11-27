# FoodFleet — Full-Stack Food Ordering, Restaurant & Delivery Management Platform

> **Your Cravings. Our Fleet.**

FoodFleet is a production-oriented food ordering, kitchen operations, delivery dispatch, and platform governance ecosystem built with **React + TypeScript + Tailwind CSS** on the frontend and **Django + Django REST Framework + Django Channels + MySQL** on the backend.

---

## Key Capabilities

- **4-Role Strict RBAC**: `SUPER_ADMIN`, `CUSTOMER`, `RESTAURANT_OWNER`, and `DELIVERY_PARTNER` enforced server-side with object-level ownership checks and role-aware frontend routes.
- **Public & Customer Experience**: Editorial landing page, restaurant discovery with multi-criteria filters (cuisine, rating, delivery time, price, city), menu browsing, smart single-kitchen cart, coupon validation, Razorpay test / simulated checkout, live WebSocket order tracking (with automatic polling fallback), OpenStreetMap route visualization, and order reviews.
- **Restaurant Management Console**: Restaurant onboarding, order acceptance/prep queue, menu & category builder, availability toggles, operating hours, and Recharts sales analytics.
- **Delivery Partner Console**: Online/offline/busy toggle, verification document uploads, assignment accept/reject, step-by-step delivery status updates, OpenStreetMap navigation, and daily/weekly earnings breakdown.
- **Super Admin Command Center**: Platform KPIs, user suspension/creation, restaurant approval queue, delivery assignment/reassignment, payment & refund processing, coupons/cuisines, review/complaint moderation, audit logs, and global configuration.

---

## Project Structure

```text
FoodFleet/
├── backend/
│   ├── foodfleet/           # Settings, ASGI (Channels + JWT WS middleware), URLs
│   ├── accounts/            # Custom User, RBAC permissions, Profiles, Addresses, Auth APIs
│   ├── restaurants/         # Cuisines, Restaurants, Operating Hours, Food Categories/Items, Favourites
│   ├── orders/              # Cart, Coupons, Orders, OrderItems, StatusHistory, OrderService, WS Consumers
│   ├── delivery/            # DeliveryAssignment workflow & earnings analytics
│   ├── payments/            # Payment intent/verification & Refund records
│   ├── reviews/             # Ratings, Reviews & Customer Complaints
│   ├── notifications/       # Persistent & real-time WebSocket notifications
│   ├── platform_admin/      # Super Admin APIs, AuditLog, PlatformConfig, seed_foodfleet command
│   └── tests/               # Backend RBAC & E2E integration tests
├── frontend/
│   └── src/
│       ├── context/         # AuthContext, CartContext, ToastContext
│       ├── components/      # Navbar, Footer, RoleGuard, DeliveryMap (OSM/Leaflet), OrderTracker
│       ├── pages/           # Public, Auth, Customer, Restaurant, Delivery & Super Admin pages
│       └── __tests__/       # Vitest + React Testing Library suite
├── .env.example
├── DATABASE_SETUP.md
├── API_DOCS.md
└── CONTRIBUTING.md
```

---

## Local Setup

### 1. Backend Setup

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate  |  macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Configure DB_ENGINE=mysql and MySQL credentials in .env (or DB_ENGINE=sqlite for quick local dev)
python manage.py migrate
python manage.py seed_foodfleet
```

Run with Django Channels ASGI server (supports HTTP + WebSockets):

```bash
daphne -b 127.0.0.1 -p 8000 foodfleet.asgi:application
```

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### 3. Development Demo Accounts (`ENABLE_DEMO_ACCOUNTS=True`, dev only)

| Role | Email | Password |
|---|---|---|
| `SUPER_ADMIN` | `admin@foodfleet.dev` | `Password123!` |
| `CUSTOMER` | `customer@foodfleet.dev` | `Password123!` |
| `RESTAURANT_OWNER` | `owner@foodfleet.dev` | `Password123!` |
| `DELIVERY_PARTNER` | `rider@foodfleet.dev` | `Password123!` |

---

## Running Tests

### Backend (`pytest`)
```bash
cd backend
pytest
```

### Frontend (`vitest` & production build)
```bash
cd frontend
npm run build
npm test
```
