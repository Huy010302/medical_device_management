# Changed files

1. `src/lib/auth.tsx`
   - UUID role_id typing.
   - Missing profile is provisioned as pending instead of silently fabricated.
   - Auth/profile failures are surfaced instead of becoming `pending`.
   - Login profile failures sign out cleanly and return an error.

2. `src/lib/store.tsx`
   - Kept aligned with the compatibility schema used by the current application.

3. `src/types/auth.ts`
   - Canonical auth role/type definitions.

4. `supabase/repair_existing_database.sql`
   - Main migration for the existing database.
   - Adds missing lookup/lifecycle fields and operation_logs.
   - Uses UUID role IDs.
   - Recreates the signup profile trigger and RLS.
   - Provisions admin2 when that Auth account exists.

5. `supabase/medical_device_lifecycle_all_in_one.sql`
   - Corrected canonical fresh-install schema: roles.id and profiles.role_id are UUID.

6. `supabase/rls_policies_v2.sql`
   - Replaced with a deprecation notice so the old incompatible RLS is not accidentally run.
