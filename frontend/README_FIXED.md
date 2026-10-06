# MedDevice Lifecycle Management - Fixed project

This package is aligned with the CURRENT Supabase schema reported from the project.

## Important

The existing database uses UUIDs for `roles.id` and `profiles.role_id`.
Do **not** run the old `supabase/rls_policies_v2.sql`; it is intentionally disabled.

## 1. Repair the existing Supabase database

Open Supabase -> SQL Editor and run:

`supabase/repair_existing_database.sql`

This migration is additive. It does not delete existing data and does not change
`profiles.role_id` from UUID.

It adds the frontend compatibility columns/tables that were missing:

- device_categories.is_active / sort_order / timestamps
- departments.sort_order / updated_at
- device_statuses.is_active / sort_order / color_class / timestamps
- purchase_statuses
- device compatibility fields (`category`, `qr_data`, audit fields)
- missing lifecycle fields and `created_at`
- operation_logs
- signup -> pending profile trigger
- UUID-compatible role helper and RLS policies
- admin profile provisioning for `admin2@benhvien.local` if that Auth user exists

The SQL ends with a verification query. For `admin2@benhvien.local`, expect:

`role_code = admin` and `is_active = true`.

## 2. Replace frontend files

Copy these files over the same paths in your current project:

- `src/lib/auth.tsx`
- `src/lib/store.tsx`
- `src/types/auth.ts`

The included `auth.tsx` no longer turns a profile/database failure into a fake
`pending` user. If an authenticated user has no profile, it safely provisions a
pending profile and then reloads it.

## 3. Clear the old browser session

Open DevTools -> Console and run:

```js
localStorage.clear();
sessionStorage.clear();
location.reload();
```

Then log in with the Auth credentials of your admin user.

## 4. Start the frontend

```powershell
npm install
npm run build
npm run dev
```

## 5. Big Data pipeline

No changes are required to the working HDFS/Spark pipeline for this frontend fix.
The existing analytics export can continue to produce the nine dashboard datasets.

## 6. Canonical schema for a new deployment

For a completely fresh Supabase database, use:

`supabase/medical_device_lifecycle_all_in_one.sql`

This version has also been corrected so `roles.id` and `profiles.role_id` are UUID.
