#!/bin/sh
# minio-createbucket: creates the bucket Supabase Storage uses (STORAGE_S3_BUCKET=stub), then exits.
set -e
mc alias set supabase-minio http://supabase-minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb --ignore-existing supabase-minio/stub
