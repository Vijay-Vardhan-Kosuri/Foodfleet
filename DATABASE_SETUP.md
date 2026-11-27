# FoodFleet Database Setup Guide (MySQL 8.0)

FoodFleet uses **MySQL 8.0** via Django ORM (`PyMySQL` driver) in production and local MySQL environments, with an optional `DB_ENGINE=sqlite` toggle for isolated test runs.

## 1. Create the MySQL Database

Connect to MySQL 8.0:

```sql
CREATE DATABASE foodfleet_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'foodfleet_user'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON foodfleet_db.* TO 'foodfleet_user'@'localhost';
FLUSH PRIVILEGES;
```

## 2. Configure `backend/.env`

```env
DB_ENGINE=mysql
DB_NAME=foodfleet_db
DB_USER=foodfleet_user
DB_PASSWORD=strong_password_here
DB_HOST=127.0.0.1
DB_PORT=3306
```

## 3. Apply Migrations & Seed Demo Data

```bash
cd backend
python manage.py makemigrations
python manage.py migrate
python manage.py seed_foodfleet
```

## Schema Overview

- **Accounts**: `ff_users`, `ff_customer_profiles`, `ff_delivery_partner_profiles`, `ff_addresses`
- **Restaurants**: `ff_cuisine_categories`, `ff_restaurants`, `ff_restaurant_addresses`, `ff_restaurant_operating_hours`, `ff_food_categories`, `ff_food_items`, `ff_favourite_restaurants`
- **Orders & Cart**: `ff_coupons`, `ff_carts`, `ff_cart_items`, `ff_orders`, `ff_order_items`, `ff_order_status_history`
- **Delivery & Payments**: `ff_delivery_assignments`, `ff_payments`, `ff_refunds`
- **Engagement & Admin**: `ff_reviews`, `ff_complaints`, `ff_notifications`, `ff_audit_logs`, `ff_platform_config`
