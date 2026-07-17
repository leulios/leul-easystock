# EasyStock 📦 📉

**EasyStock** is a modern, cloud-first, multi-tenant inventory and retail management platform. Engineered for independent retailers and multi-branch SMBs, EasyStock offers an enterprise-grade backend wrapped in a remarkably intuitive, responsive User Interface.

This repository holds the Frontend Application (Vite + React) which connects natively to a serverless PostgreSQL database (Supabase).

## 🚀 The Business Pipeline & SaaS Model

EasyStock is positioned as an aggressive disruptor in the Point-of-Sale (POS) and Retail Management sector. We provide a **strict multi-tenant cloud solution** eliminating the heavy infrastructure costs required by legacy ERPs (like Odoo or SAP Business One).

### 🎯 Value Proposition
1. **Zero CapEx for Merchants:** Cloud-native architecture means no local servers.
2. **Absolute Data Isolation:** Row-Level Security ensures mathematical isolation between competing shops using the same database.
3. **Loss Prevention:** Automated Lot tracking (FIFO) prevents inventory spoilage proactively.
4. **Frictionless Onboarding:** Owners can provision retail 'Shopkeeper' accounts instantly with synthetically generated employee IDs.

### 💰 Subscription Strategy & Monetization
EasyStock employs a freemium-to-enterprise pipeline to reduce adoption friction while capturing immense lifetime value (LTV):

| Tier | Price | Target Market | Key Limitations / Features |
| :--- | :--- | :--- | :--- |
| **Starter** | **Free** | Core Mom-and-Pop Shops | Single shop, max 500 SKUs, 1 Owner Account. Drives top-of-funnel acquisition. |
| **Professional** | **$49/mo** | **Growing Retailers (Core)** | **Unlimited SKUs, multi-branch support, comprehensive expiry tracking, unlimited Shopkeepers.** |
| **Enterprise** | **Custom** | Distributors & Chains | API integration, white-leveling, dedicated SLAs, specialized POS hardware routing. |

> **Financial Outlook:** With serverless backend costs scaling linearly (and very cheaply) mapped to egress/storage, standard Gross Margins are projected at **80-85% at scale**.

---

## 🛠 Features

* **Advanced Inventory Management:** Supports root products, deeply configurable variants (sizes, capacities, colors), and automatic low-stock alerting.
* **Lot & Expiry Tracking (FIFO):** Perfect for grocery, pharmacy, or FMCG retail. Calculates expiry deltas and actively warns users of impending spoilage.
* **Multi-Tenant Security Architecture:** Data is completely isolated per shop at the database layer using Postgres Row-Level Security (RLS). A shopkeeper in Branch A physically cannot pull data from Branch B.
* **Sales & Invoicing:** Instantly generate sales orders, calculate variable tax rates, and export pristine, print-ready PDF invoices.
* **Centralized Dashboard:** Macro-level financial overviews, recent transaction ledgers, and inventory health metrics.

---

## 💻 Technology Stack

* **Frontend:** React.js, React Router DOM v6
* **Build Tool:** Vite (Ultra-fast HMR)
* **Styling:** Vanilla CSS 3 with Custom CSS Variables (Design System) & Lucide Icons
* **Backend / Database:** Supabase (PostgreSQL 17, GoTrue Auth, PostgREST API)
* **Hosting (Recommended):** Vercel or Netlify

---

## ⚙️ Local Development Setup

### 1. Prerequisites
* Node.js (v18 or higher)
* NPM or Yarn
* A Supabase Account and Project

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/easystock.git
cd easystock
npm install
```

### 3. Environment Variables

Create a `.env` file in the root of the project. You will need your Supabase Project URL and Anon Public Key.

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-super-long-jwt-anon-key
```

### 4. Database Schema Setup

You must deploy the Supabase schema to your connected database. 
The schema requires several tables including: `shops`, `profiles`, `products`, `product_variants`, `stock_lots`, `sales_orders`, and `sales_order_items`. 

*Crucially, you must enable and configure Row-Level Security (RLS) policies to ensure multi-tenant isolation.*

### 5. Running the Application

Start the local Vite development server:

```bash
npm run dev
```

The application will be accessible at `http://localhost:5173`.

---

## 🔐 Security & Access Control

EasyStock uses a two-factor approach to security combining JWTs and Database constraints:
1. **Authentication:** Handled entirely by Supabase GoTrue.
2. **Authorization (RLS):** Policies are evaluated directly inside Postgres:
   ```sql
   CREATE POLICY "staff can read their shop data" ON public.products
     FOR SELECT USING (shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid()));
   ```
   This guarantees that bugs in the frontend application cannot result in a data breach across tenants.

---

## 🤝 Contributing
1. Fork the repo and create your feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add some amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## 📄 License
Commercial License — Proprietary Software. All rights reserved.
