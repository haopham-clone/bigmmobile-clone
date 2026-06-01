-- Local dev seed: runs automatically on `supabase db reset`

INSERT INTO public.products (id, brand, model, storage_ram, color, condition, category, sku, cost_price, selling_price, quantity)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Apple', 'iPhone 12 256GB Grade A++', '256GB', 'Black', 'Grade A++', 'devices', 'iphone-12-256gb-grade-a-2', 450, 599, 5),
  ('10000000-0000-4000-8000-000000000002', 'Apple', 'iPhone 15 Pro 256GB', '256GB', 'Natural Titanium', 'Refurbished', 'devices', 'iphone-15-pro-256gb', 980, 1199, 2),
  ('10000000-0000-4000-8000-000000000003', 'Samsung', 'Galaxy S24 Ultra 512GB', '512GB', 'Black', 'New', 'devices', 'samsung-galaxy-s24-ultra-512', 1350, 1599, 1),
  ('10000000-0000-4000-8000-000000000004', 'Google', 'Pixel 8 128GB', '128GB', 'Obsidian', 'Refurbished', 'devices', 'google-pixel-8-128gb', 520, 649, 0),
  ('10000000-0000-4000-8000-000000000005', 'Samsung', 'Galaxy Z Series Screen Protector', NULL, 'Unknown', 'New', 'screen-protectors', '9h-og-full-coverage-tpg-screen-protectorsub-screen-samsung-galaxy-z-series', 12, 49.99, 8),
  ('10000000-0000-4000-8000-000000000006', 'Generic', 'Clear Hard Case iPhone 15', NULL, 'Clear', 'New', 'phone-cases', 'clear-hard-case-iphone-15', 5, 19.99, 12)
ON CONFLICT (sku) DO NOTHING;
