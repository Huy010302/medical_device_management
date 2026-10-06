The SQL schema intentionally matches the actual PostgreSQL schema supplied during the project review.
It does NOT add frontend-only columns such as created_at to tables where they do not exist.
It also does not create purchase_statuses or operation_logs.
Authentication is local: auth_users stores password hashes; profiles stores application role/profile data.
