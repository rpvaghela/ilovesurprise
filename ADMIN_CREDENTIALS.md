# ILoveSurprises.com — Administrator Credentials & Access Document

> **CONFIDENTIAL & RESTRICTED**  
> This document contains authoritative administrator credentials for managing the ILoveSurprises.com platform, e-commerce storefront, orders, representatives, compensation plans, and system settings.

---

## 1. Primary Executive Administrator Credentials

| Property | Value | Notes |
| :--- | :--- | :--- |
| **Admin Portal URL** | `https://ilovesurprises.com/admin` | Primary live production admin portal |
| **Alternative IP URL** | `http://177.7.41.135/admin` | Direct server IP access |
| **Local Development** | `http://localhost:5173/admin` | Local Vite development server |
| **Administrator Email** | `ilovesurprisesdotcom@gmail.com` *(or `admin@ilovesurprises.com`)* | Verified active Super Administrator |
| **Administrator Password** | `Dreambig1979!` | Password hashed with bcrypt (10 rounds) in Supabase DB |
| **Assigned Role** | `ADMIN` / `SUPER_ADMIN` | Unrestricted executive permissions |
| **Account Status** | `ACTIVE` | Verified & authenticated |

---

## 2. Database Admin Table Schema (`admin_accounts`)

A dedicated `admin_accounts` table is maintained in the PostgreSQL Supabase database to track administrative accounts, access levels, and audit metadata alongside the core `users` authentication table.

### Schema Definition:
```sql
CREATE TABLE IF NOT EXISTS admin_accounts (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) DEFAULT 'Super Administrator',
  role VARCHAR(64) DEFAULT 'SUPER_ADMIN',
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Registered Record:
* **ID**: `admin_cmvgpf7m50000bqlovc6dwzk9`
* **Email**: `ilovesurprisesdotcom@gmail.com`
* **Name**: `Super Administrator`
* **Role**: `SUPER_ADMIN`
* **Is Active**: `true`
* **Notes**: `Primary super administrator account created via deployment configuration.`

---

## 3. Administrator Capabilities & Permissions

Logging in with these credentials provides access to all modules in the Admin Control Center:

1. **Executive Overview & KPIs**: Real-time sales, net revenue, order volume, live customer count, conversion rate, and commission analytics.
2. **Product Catalog & Inventory**: Create, update, toggle active status, scent notes, ring sizes, and surprise reveals for all products.
3. **Collections Management**: Manage featured collections, category hierarchy, hero badges, and promotional banners.
4. **Order Processing & Fulfillment**: Track unfulfilled, processing, shipped, and delivered orders with full line items and shipping addresses.
5. **Representative Network & MLM**: Manage independent representatives, downline hierarchies, rank qualifications, and commissions.
6. **Memberships & Billing**: Manage $19.99/mo consultant subscriptions, billing schedules, and grace periods.
7. **Jewelry Appraisals**: Review appraisal submissions, assign valuations, and issue digital certificates.
8. **System & Store Settings**: Manage store policies, free shipping threshold ($50), support email, Stripe webhook status, and API health.

---

## 4. Authentication Architecture

* **Endpoint**: `POST /api/auth/login`
* **Token Standard**: Signed JSON Web Token (`JWT`) with `7d` expiration (`30d` with Remember Me).
* **Role Verification**: Admin routes reject any token whose payload role is not `ADMIN`.
* **Frontend Sync**: [AdminLogin.tsx](file:///c:/Users/cheta/OneDrive/Desktop/Devlopment/Suprise/frontend/src/pages/AdminLogin.tsx) automatically authenticates via `authService.adminLogin`, populates the default administrator placeholder, and includes a one-click **"Quick Fill"** button for authorized administrators.

---

*Last Synchronized: October 20, 2026*  
*Environment: Production (Hostinger VPS 177.7.41.135 & Supabase AWS Pooler)*
