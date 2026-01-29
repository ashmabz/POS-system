# Remediation Plan: POS System Improvements

This plan outlines the steps to address the findings from the codebase audit, prioritizing security and performance.

## Phase 1: Security Hardening (High Priority)

1.  **Secure JWT Secret Handling (`lib/auth.ts`)**
    *   **Goal:** Eliminate the hardcoded fallback secret to prevent security risks in production.
    *   **Action:** Modify `lib/auth.ts` to throw a hard error if `JWT_SECRET` is missing in `NODE_ENV=production`. For development, we can keep a fallback but log a prominent warning.

2.  **Standardize API Authorization**
    *   **Goal:** Prevent future security leaks by centralizing access control.
    *   **Action:** Create a Higher-Order Function (HOF) `withAuth` in `lib/api-middleware.ts`.
    *   **Implementation:**
        ```typescript
        // usage: export const GET = withAuth(handler, ['ADMIN', 'MASTER']);
        ```
    *   **Scope:** Refactor existing API routes (`api/users`, `api/shops`, etc.) to use this wrapper.

## Phase 2: Performance Optimization (High Priority)

3.  **Refactor Reports API (`app/api/reports/route.ts`)**
    *   **Goal:** Fix the OOM (Out of Memory) risk and improve speed.
    *   **Action:** Replace JavaScript in-memory `.reduce()` calculations with Database aggregations.
    *   **Implementation:** Use `prisma.sale.aggregate({ _sum: { ... }, _count: { ... } })` for totals, profit, and void stats.

## Phase 3: Type Safety & Validation (Medium Priority)

4.  **Implement Zod Validation**
    *   **Goal:** Ensure API robustness and eliminate `any` types.
    *   **Action:** Install `zod`.
    *   **Implementation:** Create schemas for critical actions:
        *   `loginSchema` (username, password)
        *   `createProductSchema` (name, price, stock, etc.)
        *   `createShopSchema` (name, admin creds)
    *   **Scope:** Apply validation to `POST` endpoints in `api/auth`, `api/products`, and `api/shops`.

## Phase 4: Code Cleanup & Logic (Low Priority)

5.  **Centralize Session Logic**
    *   **Goal:** Reduce code duplication.
    *   **Action:** The `withAuth` wrapper from Phase 1 will naturally handle session fetching, cleaning up the code significantly.

6.  **Fix "Client-Side" Filtering**
    *   **Goal:** Reduce payload size.
    *   **Action:** Ensure `api/products` fully supports filtering by `shopId` and `category` at the DB level (already mostly done, but verify usage in `pos/page.tsx`).

---

**Proposed Order of Execution:**
1.  **Phase 1** (Security) - Immediate
2.  **Phase 2** (Performance) - Critical for scalability
3.  **Phase 3** (Validation) - For stability
