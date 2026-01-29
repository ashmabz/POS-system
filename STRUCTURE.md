# Project Structure: Backend vs. Frontend

This document explains how the POS system is organized to help you distinguish between Backend (Server-side) and Frontend (Client-side) code.

## 📂 Backend (Server-Side)
Logic that runs on the server, interacts with the database, and handles security.

*   **`prisma/schema.prisma`**: The Database Schema. Defines your tables (MySQL).
*   **`app/api/`**: API Routes. These are your "Controllers".
    *   Example: `app/api/products/route.ts` handles fetching and saving products.
*   **`lib/`**: Server Utilities.
    *   `lib/prisma.ts`: Database connection client.
    *   `lib/auth.ts`: Session and JWT logic.
    *   `lib/api-middleware.ts`: Security wrapper for API routes (`withAuth`).
    *   `lib/audit.ts`: Logic for recording audit logs.
    *   `lib/validations.ts`: Zod schemas for validating incoming data.

## 📂 Frontend (Client-Side)
Code that runs in the user's browser (React components).

*   **`app/` (excluding `api/`)**: Pages and Layouts.
    *   `app/pos/page.tsx`: The main POS terminal UI.
    *   `app/inventory/page.tsx`: Inventory management UI.
*   **`app/components/`**: Reusable UI elements (Header, Buttons, Modals).
*   **`app/globals.css`**: Global styles and Tailwind CSS configuration.
*   **`hooks/` (Future)**: Any custom React hooks should go here.

## 🔄 Shared
*   **`package.json`**: Dependencies for both sides.
*   **`tailwind.config.ts`**: Styling rules.
*   **`tsconfig.json`**: TypeScript configuration.

---

### 💡 Key Tip:
If a file starts with `'use client';`, it is **Frontend** (React/Browser).
If it doesn't, and it's inside `app/api/` or `lib/`, it is primarily **Backend**.
