# ILoveSurprises Backend

Backend API and business-logic service for **ILoveSurprises.com**, a custom e-commerce and 5-level affiliate/MLM platform.

The backend is responsible for authentication, catalog management, CMS, cart and checkout, orders, payments, affiliate attribution, commission processing, payouts, admin operations, appraisal records, migration, and auditability.

---

## 🚀 Tech Stack

* **Node.js**
* **Express.js**
* **TypeScript**
* **PostgreSQL**
* **Supabase** — managed PostgreSQL infrastructure
* **Prisma ORM**
* **Zod** — request validation
* **JWT / secure authentication**
* **REST API**

Additional infrastructure such as Redis/background jobs, payment gateways, email services, and object storage may be added as required.

---

## 📌 Project Scope

ILoveSurprises is more than a traditional e-commerce application.

The backend supports:

* Customer accounts
* Affiliate/representative accounts
* Staff and admin accounts
* Product catalog
* Product variants and options
* Categories and collections
* CMS
* SEO metadata
* Shopping cart
* Checkout
* Upsells
* Orders
* Payments and webhooks
* Refunds
* Multi-currency
* Affiliate referral attribution
* 5-level MLM genealogy
* Commission ledger
* Payouts
* Jewelry appraisal/certificate records
* Audit logs
* Legacy data migration
* Admin and staff permissions

---

# 🏗️ Architecture

The application follows a layered backend architecture.

```text
Next.js Frontend
       │
       ▼
   Express API
       │
       ├── Authentication
       ├── Catalog
       ├── CMS
       ├── Cart
       ├── Orders
       ├── Payments
       ├── Affiliates
       ├── Commissions
       ├── Payouts
       ├── Appraisals
       └── Admin
       │
       ▼
     Prisma
       │
       ▼
PostgreSQL / Supabase
```

The Express backend is the main business-logic layer.

The frontend must not be trusted for financial calculations, commission calculations, authorization, or other sensitive business rules.

---

# 📂 Project Structure

```text
ilovesurprises-backend/
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── src/
│   │
│   ├── config/
│   │   ├── env.ts
│   │   └── database.ts
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validation.middleware.ts
│   │
│   ├── modules/
│   │   │
│   │   ├── auth/
│   │   ├── users/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── collections/
│   │   ├── cms/
│   │   ├── cart/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── affiliates/
│   │   ├── commissions/
│   │   ├── payouts/
│   │   ├── appraisals/
│   │   ├── admin/
│   │   └── migration/
│   │
│   ├── routes/
│   │   └── index.ts
│   │
│   ├── utils/
│   │
│   ├── app.ts
│   └── server.ts
│
├── tests/
│
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

Each major business domain should remain isolated inside its own module.

---

# ⚙️ Getting Started

## 1. Clone the repository

```bash
git clone <repository-url>
cd ilovesurprises-backend
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Then configure the required values.

Example:

```env
PORT=3000

DATABASE_URL="your-postgresql-connection-string"

JWT_SECRET="your-secret"

NODE_ENV="development"
```

Do **not** commit `.env` or production secrets to Git.

---

# 🗄️ Database Setup

The project uses **PostgreSQL** with **Prisma ORM**.

After configuring `DATABASE_URL`, run:

```bash
npx prisma generate
```

Then create/apply the initial migration:

```bash
npx prisma migrate dev --name init
```

This will:

* Create the database tables
* Apply the Prisma migration
* Generate Prisma Client

---

# ▶️ Running the Backend

Start the development server:

```bash
npm run dev
```

Expected output:

```text
Backend is running at http://localhost:3000
```

If another port is configured or the default port is already occupied, the application may run on a different port.

---

# 🧪 Verification

Once the server starts, verify that the API is reachable.

Example:

```text
http://localhost:3000
```

A health endpoint should be available:

```text
GET /api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

---

# 🔐 Authentication

Authentication is implemented at the backend level.

Supported account types include:

```text
CUSTOMER
AFFILIATE
STAFF
ADMIN
```

Authentication flow:

```text
Register
   ↓
Login
   ↓
Authentication token/session
   ↓
Authenticated API requests
   ↓
Role / permission verification
```

Protected routes must verify authorization on the server.

Frontend UI restrictions are not considered sufficient security.

---

# 🛍️ Core Modules

## Products

Responsible for:

* Products
* Variants
* Options
* Pricing
* Availability
* Categories
* Collections
* Product media

Example routes:

```text
GET    /api/products
GET    /api/products/:slug
POST   /api/products
PATCH  /api/products/:id
DELETE /api/products/:id
```

---

## CMS

Responsible for managing:

* Homepage sections
* Pages
* Navigation
* Banners
* Timers
* Blog posts
* SEO metadata
* Media

The goal is to allow administrators to manage important storefront content without requiring a deployment.

---

## Cart

Responsible for:

* Cart creation
* Cart items
* Product options
* Quantity
* Upsells
* Pricing validation
* Affiliate context

Client-provided prices must never be treated as authoritative.

---

## Orders

Responsible for:

* Order creation
* Order items
* Pricing snapshots
* Customer information
* Affiliate attribution
* Payment status
* Fulfillment status
* Refunds

Orders should preserve the relevant information at the time of purchase so historical records do not change when catalog data changes later.

---

# 💳 Payments

Payment processing must use secure provider webhooks.

Important requirements:

* Verify webhook signatures
* Prevent duplicate webhook processing
* Use idempotency
* Never store raw card information
* Keep payment status synchronized with orders

Example flow:

```text
Customer Checkout
       ↓
Create Order
       ↓
Payment Provider
       ↓
Webhook
       ↓
Verify Webhook
       ↓
Update Payment
       ↓
Confirm Order
       ↓
Generate Eligible Commission
```

---

# 🤝 Affiliate System

Every affiliate can have a referral URL such as:

```text
https://ilovesurprises.com/ravi
```

Referral flow:

```text
Referral URL
     ↓
Identify Affiliate
     ↓
Record Referral Visit
     ↓
Persist Attribution
     ↓
Customer Purchases
     ↓
Attach Affiliate Attribution
     ↓
Commission Processing
```

Affiliate attribution must remain consistent throughout the customer journey.

---

# 💰 5-Level Commission System

The platform uses the following commission structure:

```text
Personal Sale     20%

Level 1            5%
Level 2            4%
Level 3            3%
Level 4            2%
Level 5            1%

Maximum            35%
```

Example:

```text
$100 commissionable order

Personal     $20
L1            $5
L2            $4
L3            $3
L4            $2
L5            $1
----------------
Total        $35
```

The commission engine must:

* Validate the commissionable base
* Identify eligible uplines
* Prevent genealogy cycles
* Apply the correct level rate
* Enforce the 35% maximum
* Create auditable ledger entries
* Support pending/available/paid states
* Support holds and reversals
* Handle refunds and chargebacks

---

# 📒 Commission Ledger

Commission records should be treated as financial records.

A commission record should contain information such as:

```text
Order
Beneficiary
Level
Rate
Commission Base
Amount
Status
Rule Version
Created At
Updated At
```

Historical commission records should not simply be deleted when a refund occurs.

Instead:

```text
Original Commission
       ↓
Refund / Chargeback
       ↓
Reversal / Adjustment
```

This keeps the financial history auditable.

---

# 💸 Payouts

Commission lifecycle:

```text
Pending
   ↓
Available
   ↓
Payout Requested
   ↓
Approved
   ↓
Paid
```

Additional states may include:

```text
Hold
Void
Reversed
```

Payout records should maintain payment references and reconciliation information.

---

# 🛡️ Security Rules

The backend must follow these principles:

### Never trust the client

The server must independently validate:

* Product prices
* Discounts
* Shipping
* Tax
* Upsells
* Commission calculations
* User permissions
* Payment status

### Financial calculations

Use proper server-side money/decimal handling.

Avoid JavaScript floating-point calculations for financial records.

### Authorization

Every protected operation must verify permissions server-side.

### Webhooks

Payment webhooks must be:

* Signature verified
* Idempotent
* Retry-safe

### Secrets

Never expose:

```text
DATABASE_URL
JWT_SECRET
Payment secrets
API keys
Private credentials
```

to the frontend.

---

# 🔄 Development Workflow

Create a feature branch before implementing a feature:

```bash
git checkout -b feature/auth
```

Example branches:

```text
feature/auth
feature/products
feature/cart
feature/orders
feature/payments
feature/affiliate
feature/commission
feature/admin
```

Keep commits focused:

```text
feat: add user registration
feat: add product CRUD
feat: add affiliate attribution
fix: prevent duplicate commission creation
```

Avoid committing directly to the main production branch.

---

# 🧭 Development Phases

The backend will be developed in the following order:

### Phase 1 — Foundation

* Express setup
* TypeScript
* Prisma
* PostgreSQL
* Environment configuration
* Error handling
* Validation
* Initial schema

### Phase 2 — Authentication & RBAC

* Users
* Authentication
* Roles
* Permissions
* Admin authorization

### Phase 3 — Catalog

* Products
* Variants
* Options
* Categories
* Collections
* Media
* Pricing

### Phase 4 — CMS

* Pages
* Sections
* Navigation
* Blog
* SEO
* Timers

### Phase 5 — Commerce

* Cart
* Upsells
* Checkout
* Orders
* Payments
* Refunds
* Fulfillment
* Multi-currency

### Phase 6 — Affiliate

* Affiliate registration
* Sponsor relationships
* Referral URLs
* Referral tracking
* Attribution

### Phase 7 — MLM

* Genealogy
* 5-level commission engine
* Commission ledger
* Commission lifecycle
* Refund reversals

### Phase 8 — Operations

* Admin dashboard
* Staff permissions
* Payouts
* Appraisals
* Reports
* Audit logs

### Phase 9 — Migration

* Product migration
* Category migration
* Media migration
* SEO migration
* Approved customer/order migration
* Reconciliation

### Phase 10 — QA & Production

* Automated tests
* Integration tests
* Payment testing
* Commission testing
* Security testing
* Migration verification
* Production deployment
* Monitoring
* Backup/restore verification

---

# 🧪 Testing Priorities

Special attention should be given to:

```text
Authentication
Authorization
Order creation
Payment webhooks
Duplicate webhooks
Refunds
Affiliate attribution
Genealogy
Commission calculations
Commission reversals
Payouts
Permissions
Migration reconciliation
```

Critical financial operations should be idempotent.

For example:

```text
Payment webhook received
        ↓
Already processed?
   ↙          ↘
 YES           NO
 ↓              ↓
Ignore       Process
              ↓
        Create/update order
              ↓
        Generate commission
              ↓
        Mark webhook processed
```

A repeated webhook must never create duplicate orders or commissions.

---

# 🌳 Database Development

When changing the Prisma schema:

```bash
npx prisma migrate dev --name describe_change
```

Example:

```bash
npx prisma migrate dev --name add_affiliate_profile
```

Generate Prisma Client when necessary:

```bash
npx prisma generate
```

For inspecting the database during development:

```bash
npx prisma studio
```

---

# 🌍 Environment Strategy

Use separate environments for:

```text
Development
Staging
Production
```

Never use production credentials in local development.

Each environment should have its own:

* Database
* Secrets
* Payment configuration
* API keys
* Storage configuration

---

# 📋 Current Status

```text
[ ] Project foundation
[ ] Database configuration
[ ] Initial Prisma schema
[ ] Authentication
[ ] RBAC
[ ] Product catalog
[ ] CMS
[ ] Cart
[ ] Checkout
[ ] Orders
[ ] Payments
[ ] Affiliate system
[ ] MLM commission engine
[ ] Payouts
[ ] Admin
[ ] Appraisal
[ ] Migration
[ ] QA
[ ] Production deployment
```

Update this section as development progresses.

---

# ⚠️ Important Development Principle

This project contains financial, affiliate, payment, and customer data.

Speed is important, but business-critical logic must not be implemented as temporary frontend logic.

The backend should remain the source of truth for:

```text
Prices
Orders
Payments
Affiliate attribution
Commission calculations
Payouts
Permissions
Financial history
```

Build the simple store flow first, then layer the affiliate/MLM system on top of a stable order system.

---

## 📚 Project Documentation

Additional documentation should be maintained for:

* Database schema
* API documentation
* Authentication
* Affiliate/MLM rules
* Commission calculation rules
* Payment integration
* Migration mapping
* Deployment
* Backup/restore
* Environment variables
* Admin usage

---

## 📄 License

Private / Proprietary project.

Unauthorized copying, redistribution, or commercial use is not permitted.
