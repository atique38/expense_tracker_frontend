# Expense Tracker Frontend

A Vue 3 and Vite single-page application for tracking personal finances through a Laravel API. Users sign in with a name and 11-digit phone number, then manage accounts, categories, transactions, and budgets from a protected dashboard.

## Overview

This project is the frontend for an expense tracking system. It does not own the financial data itself. Instead, it reads and writes user-scoped records from the backend API and keeps the signed-in user in local storage so the session survives refreshes.

The application is built around four core finance objects:

- Accounts: places where money lives, such as cash, bank, cards, or mobile wallets.
- Categories: income and expense groups used to organize records.
- Transactions: income and expense entries linked to an account and optionally a category.
- Budgets: spending limits that can be tied to a category or applied to all expenses.

## Key Features

- Passwordless login with name and phone number
- Automatic redirect to the correct page based on authentication state
- Dashboard overview with income, expenses, balance, savings rate, weekly flow, recent transactions, accounts, and budgets
- Create, edit, and delete accounts
- Create, edit, and delete income and expense categories
- Record, edit, and delete transactions
- Create, edit, and delete budgets with overspending tracking
- Responsive UI that works on desktop and mobile

## Tech Stack

- Vue 3
- Vue Router 5
- Vite
- JavaScript
- Laravel backend API

## Getting Started

### Prerequisites

- Node.js `^22.18.0 || >=24.12.0`
- npm
- A running Laravel API for the expense tracker backend

### Install dependencies

```sh
npm install
```

### Configure the API

The frontend talks to the backend through `/api` routes.

- During local development, Vite proxies `/api` to `http://127.0.0.1:8000` by default.
- If your Laravel app runs on another host or port, set `VITE_API_PROXY_TARGET` before running `npm run dev`.
- For production builds, set `VITE_API_BASE_URL` to the public Laravel base URL.

Example environment values:

```env
# Development proxy target
VITE_API_PROXY_TARGET=http://127.0.0.1:8000

# Production or direct API base URL
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Run the app

```sh
npm run dev
```

### Build for production

```sh
npm run build
```

### Preview the production build

```sh
npm run preview
```

### Format source files

```sh
npm run format
```

## Application Flow

1. Open `/login` and sign in with your name and 11-digit phone number.
2. The backend returns the user profile, and the frontend stores it locally.
3. The app redirects to `/dashboard`.
4. Create accounts and categories.
5. Add transactions and budgets.
6. Review totals, trends, and overspending from the dashboard.

## Routes

- `/login` - Sign in screen
- `/dashboard` - Overview dashboard
- `/dashboard/accounts` - Manage accounts
- `/dashboard/categories` - Manage categories
- `/dashboard/transactions` - Review and edit transactions
- `/dashboard/budgets` - Create and manage budgets

## API Endpoints Used

- `POST /api/login`
- `GET /api/users/:userId/dashboard`
- `POST /api/users/:userId/accounts`
- `PUT /api/users/:userId/accounts/:accountId`
- `DELETE /api/users/:userId/accounts/:accountId`
- `GET /api/users/:userId/categories`
- `POST /api/users/:userId/categories`
- `PUT /api/users/:userId/categories/:categoryId`
- `DELETE /api/users/:userId/categories/:categoryId`
- `GET /api/users/:userId/transactions`
- `POST /api/users/:userId/transactions`
- `PUT /api/users/:userId/transactions/:transactionId`
- `DELETE /api/users/:userId/transactions/:transactionId`
- `POST /api/users/:userId/budgets`
- `PUT /api/users/:userId/budgets/:budgetId`
- `DELETE /api/users/:userId/budgets/:budgetId`

## Project Structure

- `src/views` - Route-level screens
- `src/components` - Shared layout components
- `src/services` - API client helpers
- `src/utils` - Auth and formatting helpers
- `src/router` - Route definitions and guards
- `src/assets` - Global styles and project notes

## Notes

- Logged-in user data is stored in `localStorage` under `expense-tracker:user`.
- Signing out clears the stored user and redirects to `/login`.
- The frontend expects user-scoped data from the Laravel backend.
