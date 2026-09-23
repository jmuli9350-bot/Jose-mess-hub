# Biz Track

Fielddesk is a React dashboard backed by Supabase for running a small business from one workspace.

## Included workflows

- Role-aware views for Owner, Manager, Stock Keeper, Cashier, and Worker
- Daily attendance check-in and check-out
- Payroll summary and monthly budget tracking
- Department and team performance surface
- Inventory watchlist with stock severity
- Sales performance and daily sales summary
- Supabase persistence for workspace data, site-admin business accounts, registration requests, and platform settings
- Online/offline detection with pending-sync feedback

## Run locally

```bash
npm install

npm run dev
```

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run [`supabase.sql`](supabase.sql).
3. Copy [`.env.example`](.env.example) to `.env.local` and fill in the project URL and anon key. These variables are required; the app persists all business data in Supabase and operates online-only. No browser storage or offline synchronization is used.
4. Restart Vite with `npm run dev`.

The SQL migration enables tenant RLS and requires an authenticated Supabase user with a row in `public.tenant_memberships`. Provision each business owner or worker in Supabase Auth using the app's login email convention `<username>@biztrack.app`, then insert their `(user_id, tenant_id, role)` membership using a trusted admin process. Do not grant clients insert or update access to that table. Platform administrators must have `app_metadata.role = platform_admin`.

The browser uses the public anon key only. Do not put a Supabase service-role key in this app. Biometric data is WebAuthn credential metadata only: credential IDs and verification proofs are stored in the non-exposed `private_biometrics` schema and accessed through tenant-checked RPCs. Raw biometric templates or fingerprint/face images are never stored.

Fingerprint readers are tenant-configurable through `public.biometric_devices`: each business stores its own provider, model, device identifier, and local bridge URL. The private credential registry stores only the reader's opaque subject identifier and enforces one subject per worker/business. A worker can register in multiple businesses, but cannot receive a second biometric in the same business. Raw fingerprint images/templates are never stored by Biz Track.

Hardware integration requires a small local bridge supplied by the reader manufacturer or SDK. The bridge should expose a provider-neutral contract: `POST /enroll` returns `{ "subjectIdentifier": "..." }`, and `POST /verify` accepts `{ "subjectIdentifier": "..." }` and returns `{ "verified": true }`. Different tenants can point `bridge_url` and `provider/model` at different reader integrations.

When an enabled row exists in `public.biometric_devices` with a `bridge_url`, the app uses that scanner bridge for worker enrollment and verification. Configure one row per tenant, for example:

```sql
insert into public.biometric_devices (tenant_id, provider, model, device_identifier, bridge_url)
values ('your-tenant-id', 'vendor-name', 'reader-model', 'reader-01', 'https://scanner-bridge.example.com');
```

The bridge must be reachable from the browser, allow CORS from the deployed app, and use HTTPS when Biz Track is served over HTTPS. A USB reader by itself cannot be called directly by a normal web page; it needs the manufacturer's local bridge or SDK service. If no enabled bridge is found, Biz Track falls back to the browser's WebAuthn/passkey prompt.

## Deploy to Vercel

From the project folder, run:

```bash
npx vercel --prod
npx vercel alias <deployment-url> Biztrack1.vercel.app
```

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the Vercel project environment variables for Production, then redeploy. The existing [`vercel.json`](vercel.json) keeps client-side routes working on refresh.
