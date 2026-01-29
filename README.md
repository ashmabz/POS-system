# POS & Inventory System - Small Shop Edition

## Setup

1.  **Environment Variables:** Create a `.env.local` file and add:
    ```env
    DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DB_NAME"
    JWT_SECRET="your_secret"
    ```
2.  **Install:** `npm install`
3.  **Database:** `npx prisma generate` followed by `npx prisma db push` to sync your MySQL schema.
4.  **Dev:** `npm run dev`
5.  **Build:** `npm run build`

## Current Features
- **Dashboard**: Main navigation hub.
- **Inventory**: 
    - View product list.
    - Add new products (Name, SKU, Price, Stock).
    - Low stock indicators.
    - Data is saved to the local database.

## Coming Next
- POS Terminal Interface
- Shopping Cart Logic
- Checkout & Receipt
