# Kassero

Modern Point of Sale (POS), inventory management, customer credit (*utang*) ledger, and sales analytics system tailored for retail and sari-sari stores.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend / Database**: [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security, atomic checkout RPCs, and soft-delete safeguards)
- **Testing**: [Vitest](https://vitest.dev/)

## Prerequisites

- **Node.js**: v20 or higher
- **Package Manager**: npm (v10+)
- **Supabase Account**: A new or existing Supabase project

## Getting Started

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd Kassero
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-publishable-key>
```

### 3. Initialize Database Schema

Open your Supabase project dashboard, navigate to the **SQL Editor**, and execute the full schema definition located at:

```
supabase/schema.sql
```

This creates:
- Core tables (`products`, `sales`, `sale_items`, `customers`, `utang_transactions`, `payments`, `digital_services`, `profiles`).
- Row Level Security (RLS) policies for authenticated staff and superadmins.
- Atomic stored procedures (`complete_checkout`, `record_customer_payment`, `adjust_stock_quantity`, `archive_customers`, `get_sales_summary`).
- Performance indexes and auto-provisioning triggers.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the Next.js development server |
| `npm test` | Runs the Vitest automated unit test suite |
| `npm run build` | Compiles the production build |
| `npm run start` | Runs the compiled Next.js production server |
| `npm run lint` | Runs Next.js ESLint checks |

## Key Features

- **Atomic Multi-Step Checkout**: Transactional checkout bundling sale creation, stock deductions, digital services, and utang balances via database RPC.
- **Customer Credit (Utang) Ledger**: Customer debt tracking, credit limit enforcement, partial/full payment history, and soft-deletion protections.
- **Inventory Tracking**: Stock counts, low-stock warnings, reorder thresholds, and quick restock actions.
- **Sales & Profit Analytics**: Server-side aggregated revenue, profit margins, payment method breakdowns, and PDF receipt downloads.
- **Role-Based Access Control**: Staff accounts (`cashier`, `admin`, `superadmin`) with secure access rules.
