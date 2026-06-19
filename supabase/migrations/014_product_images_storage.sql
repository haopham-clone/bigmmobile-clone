-- Product image uploads (Supabase Storage)
-- Bucket settings for local dev: supabase/config.toml [storage.buckets.product-images]
-- Use only id/name here for compatibility with newer storage-api schemas.

INSERT INTO storage.buckets (id, name)
VALUES ('product-images', 'product-images')
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_authenticated_insert" ON storage.objects;
CREATE POLICY "product_images_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_authenticated_update" ON storage.objects;
CREATE POLICY "product_images_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_authenticated_delete" ON storage.objects;
CREATE POLICY "product_images_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');
