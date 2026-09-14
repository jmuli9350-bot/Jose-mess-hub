# Fielddesk

Fielddesk is an offline-first React dashboard for running a small business from one workspace.

## Included workflows

- Role-aware views for Owner, Manager, Stock Keeper, Cashier, and Worker
- Daily attendance check-in and check-out
- Payroll summary and monthly budget tracking
- Department and team performance surface
- Inventory watchlist with stock severity
- Sales performance and daily sales summary
- Local persistence through `localStorage`
- Online/offline detection with pending-sync feedback

## Run locally

```bash
npm install
npm run dev
```

The current dashboard uses local sample data so the core workflows are usable immediately. Replace the local persistence layer with an API and a durable sync queue when connecting a backend.
