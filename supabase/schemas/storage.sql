-- Storage policies for the private "files" bucket (declared in config.toml). Objects sit at
-- <together_id>/<file_id>/original.bin (and thumb.bin, preview.bin), encrypted in the browser.
--   * Members of a Together read its objects (the browser decrypts them).
--   * You can only add the objects of your own upload in progress (a files row that's 'uploading'), so nothing gets
--     stored outside the quota or outside a file row.
--   * No update or delete policies: objects never change, and only the purge job (secret key) removes them.

create policy "files: members read" on storage.objects for select to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(objects.name))[1] = (select public.my_together_id())::text
  );

create policy "files: add your upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'files'
    and exists (
      select 1 from public.files f
      where f.together_id = (select public.my_together_id())
        and f.uploaded_by = (select auth.uid())
        and f.status = 'uploading'
        and objects.name in (f.original_path, f.thumb_path, f.preview_path)
    )
  );
