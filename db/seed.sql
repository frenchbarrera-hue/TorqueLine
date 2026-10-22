-- ============================================================================
-- TorqueLine — PostgreSQL seed data
-- Run:  psql torqueline -f db/seed.sql
-- Idempotent: safe to run more than once.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------
INSERT INTO brands (name, slug, logo_path, country, description) VALUES
('TorqueLine',   'torqueline',   'brands/images_transparent.png',   'Philippines', 'House brand premium motor oil engineered for maximum engine protection.'),
('Mobil 1',      'mobil-1',      'brands/images-7_transparent.png', 'USA',         'Factory-sealed Mobil 1 range, authorised distributor stock.'),
('Castrol EDGE', 'castrol-edge', 'brands/images-6_transparent.png', 'UK',          'Castrol EDGE with Trizone technology.'),
('Shell Helix',  'shell-helix',  'brands/images-5_transparent.png', 'UK',          'Shell Helix synthetic technology oils.'),
('Total Quartz', 'total-quartz', 'brands/images-4_transparent.png', 'France',     'Total Quartz synthetic and semi-synthetic range.'),
('BP VEG',       'bp-veg',       'brands/images-2_transparent.png', 'UK',          'BP Visco Energizer technology range.'),
('ARKO Tection', 'arko-tection', 'brands/images-3_transparent.png', 'Germany',    'ARKO premium passenger car motor oils.'),
('Liqui Moly',   'liqui-moly',   'brands/images_transparent.png',   'Germany',    'German additive technology motor oils.')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Formulations
-- ---------------------------------------------------------------------------
INSERT INTO formulations (name, slug, oil_type, base_oil, description) VALUES
('Full Synthetic',  'full-synthetic',  'synthetic',        'Group IV PAO',      'Ultimate protection for modern engines across all temperatures.'),
('High Mileage',   'high-mileage',   'synthetic',        'Group III+',        'Advanced seals and conditioners for engines over 75,000 miles.'),
('Diesel Blend',   'diesel-blend',   'blend',            'Group II+',         'Specialised for diesel engines under extreme pressure.'),
('Synthetic Blend','synthetic-blend', 'semi_synthetic',  'Group III',         'Balanced synthetic blend for everyday driving.'),
('Mineral',        'mineral',         'mineral',          'Group II',          'Mineral oil for older, high-mileage engines.'),
('Premium Racing', 'premium-racing',  'synthetic',        'Group V PAO',       'Track-spec fully synthetic racing oil.')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Viscosities (cold_rating / hot_rating are the numeric parts of the grade)
-- ---------------------------------------------------------------------------
INSERT INTO viscosities (grade, cold_rating, hot_rating, viscosity_index, sort_order) VALUES
('0W-20',  0, 20,  80, 10),
('0W-30',  0, 30,  85, 20),
('5W-30',  5, 30, 120, 30),
('5W-40',  5, 40, 130, 40),
('10W-40', 10, 40, 140, 50),
('15W-40', 15, 40, 155, 60),
('20W-50', 20, 50, 170, 70)
ON CONFLICT (grade) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Payment methods
-- ---------------------------------------------------------------------------
INSERT INTO payment_methods (code, name, provider, requires_reference, sort_order) VALUES
('gcash',     'GCash',              'G-Xchange',     TRUE,  1),
('maya',      'Maya',               'Maya',          TRUE,  2),
('shopeepay', 'ShopeePay',          'Shopee',        TRUE,  3),
('card',      'Credit / Debit Card','Visa/Mastercard',TRUE,  4),
('bank',      'Bank Transfer',      'BPI/BDO',       TRUE,  5),
('cod',       'Cash on Delivery',   'TorqueLine',    FALSE, 6)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Products (prices in PHP)
-- ---------------------------------------------------------------------------
INSERT INTO products
    (brand_id, formulation_id, viscosity_id, sku, name, slug, short_description,
     description, volume_liters, api_spec, price_php, compare_at_price_php,
     image_path, stock_qty, low_stock_threshold, attributes)
SELECT b.id, f.id, v.id,
       'TL-' || UPPER(REPLACE(SUBSTR(p.name, 1, 3), ' ', '')) || '-' || REPLACE(v.grade, '-', ''),
       p.name,
       LOWER(REGEXP_REPLACE(p.name, '[^a-zA-Z0-9]+', '-', 'g')),
       p.short_desc, p.description, p.vol, p.api, p.price, p.compare_at, p.image,
       p.stock, 5, p.attributes::jsonb
FROM (VALUES
    -- brand_slug, form_slug, viscosity, name, short_desc, description, vol, api, price, compare_at, image, stock, attributes
    ('torqueline',   'full-synthetic', '5W-30',
     'Full Synthetic 5W-30',
     'Ultimate protection for modern engines. Optimal viscosity across all temperatures.',
     'Fully synthetic Group IV PAO motor oil engineered for maximum protection in modern turbocharged and naturally aspirated engines.', 4.00, 'API SP-4 / GF-6A', 1399.00, NULL,
     'images-5-blend.png', 42, '{"engine_oil_spec":"API SP-4","fuel_economy":"high","oxidation_control":"excellent"}'),

    ('torqueline',   'high-mileage', '0W-20',
     'High Mileage 0W-20',
     'Advanced formula for engines over 75,000 miles. Reduces oil consumption and leaks.',
     'Synthetic low-viscosity oil with advanced seal conditioners that reduce oil consumption and stop leaks in high-mileage engines.', 4.00, 'API SP-4', 1549.00, NULL,
     'images-2-blend.png', 28, '{"engine_oil_spec":"API SP-4","fuel_economy":"excellent","seal_protection":"advanced"}'),

    ('torqueline',   'diesel-blend', '10W-40',
     'Diesel Blend 10W-40',
     'Specialized for diesel engines. Superior lubrication under extreme pressure conditions.',
     'High-viscosity synthetic blend built for commercial diesel engines operating under extreme cylinder pressure and extended drain intervals.', 4.00, 'API CF-4 / CK-4', 1699.00, NULL,
     'images-3-blend.png', 19, '{"engine_oil_spec":"API CK-4","soot_control":"high","high_pressure":"yes"}'),

    ('mobil-1',      'full-synthetic', '5W-30',
     'Mobil 1 5W-30',
     'Factory-sealed Mobil 1 fully synthetic with Mobil 1 Extended Performance additives.',
     'Authentic factory-sealed Mobil 1 with Extended Performance additives for deposit control and sludge prevention.', 4.00, 'API SP-4 / GF-6A', 1699.00, 1999.00,
     'brands/images-7_transparent.png', 15, '{"engine_oil_spec":"API SP-4","deposit_control":"excellent"}'),

    ('castrol-edge', 'full-synthetic', '5W-30',
     'Castrol EDGE 5W-30',
     'Trizone technology keeps the engine clean and protects for longer drain intervals.',
     'Castrol EDGE with Trizone technology, a three-strength molecule that binds to both metal surfaces and fluid to deliver extended protection.', 4.00, 'API SP-4 / GF-6A', 1549.00, NULL,
     'brands/images-6_transparent.png', 22, '{"engine_oil_spec":"API SP-4","trizone":"yes"}'),

    ('shell-helix',  'synthetic-blend', '5W-40',
     'Shell Helix 5W-40',
     'Shell PurePlus technology actively cleans sludge while you drive.',
     'Shell Helix HX7 with PurePlus technology that actively cleans sludge and deposits while the vehicle is running.', 4.00, 'API SP-4', 1399.00, NULL,
     'brands/images-5_transparent.png', 31, '{"engine_oil_spec":"API SP-4","active_cleaning":"yes"}'),

    ('total-quartz', 'synthetic-blend', '5W-40',
     'Total Quartz 5W-40',
     'Synthetic blend with Total Quartz 7000 performance additives.',
     'Semi-synthetic 7000-series oil engineered for long drain intervals and severe driving conditions.', 4.00, 'API SP-4', 1499.00, NULL,
     'brands/images-4_transparent.png', 12, '{"engine_oil_spec":"API SP-4","long_drain":"extended"}'),

    ('bp-veg',       'synthetic-blend', '10W-40',
     'BP Visco 3000 10W-40',
     'Visco Energizer technology for outstanding protection at low temperatures.',
     'Semi-synthetic oil with Visco Energizer molecules that cling to engine parts, reducing friction and wear even on short journeys.', 4.00, 'API SP-4', 1299.00, NULL,
     'brands/images-2_transparent.png', 26, '{"engine_oil_spec":"API SP-4","fuel_economy":"good"}'),

    ('arko-tection', 'mineral', '15W-40',
     'ARKO Luffe Tection 15W-40',
     'High-viscosity mineral oil for classic and older engines.',
     'Mineral-based engine oil designed to protect ageing engines and help reduce oil consumption on worn valve seats.', 4.00, 'API SL / CF', 1149.00, NULL,
     'brands/images-3_transparent.png', 35, '{"engine_oil_spec":"API SL","high_viscosity":"yes"}'),

    ('liqui-moly',   'premium-racing', '0W-30',
     'Liqui Moly Top Tec 4600 0W-30',
     'German full synthetic with Liqui Moly additive technology for maximum protection.',
     'Low-viscosity full synthetic with a modern additive package that reduces friction and deposits in turbocharged engines.', 4.00, 'API SP-4 / GF-6A', 1849.00, 2099.00,
     'brands/images_transparent.png', 9, '{"engine_oil_spec":"API SP-4","additive_tech":"liqui_moly"}')
) AS p(brand_slug, form_slug, viscosity, name, short_desc, description, vol, api, price, compare_at, image, stock, attributes)
JOIN brands       b ON b.slug = p.brand_slug
JOIN formulations f ON f.slug = p.form_slug
JOIN viscosities  v ON v.grade = p.viscosity
ON CONFLICT (sku) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------------
INSERT INTO promotions (name, code, discount_type, discount_value, starts_at, ends_at, min_order_php, max_redemptions, headline, subheadline)
VALUES
('Launch Offer 20%',  'TORQUE20', 'percent', 20, NOW() - INTERVAL '7 days', NOW() + INTERVAL '23 days', 2500, 500,
 '20% Off Your First Order', 'Use code TORQUE20 at checkout and save on any full synthetic oil.'),
('Voucher 10% + ₱100', 'TORQUE10', 'percent', 10, NOW() - INTERVAL '1 day',  NOW() + INTERVAL '29 days', 2500, 1000,
 'GET 10% OFF', 'Maintain Your Ride For Less. Plus ₱100 off your order.')
ON CONFLICT (code) DO NOTHING;

-- Link the 10% voucher to the three TorqueLine best sellers.
INSERT INTO promotion_products (promotion_id, product_id)
SELECT pr.id, p.id
FROM promotions pr, products p
WHERE pr.code = 'TORQUE10'
  AND p.name IN ('Full Synthetic 5W-30', 'High Mileage 0W-20', 'Diesel Blend 10W-40')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Admin account  (password: admin123)
-- pgcrypto's crypt() + gen_salt('bf') produces a standard bcrypt digest.
-- ---------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role, email_verified_at)
VALUES ('TorqueLine Admin', 'admin@torqueline.ph', crypt('admin123', gen_salt('bf')), 'admin', NOW())
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sample client + reviews so the rating views return real numbers
-- ---------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role, email_verified_at)
VALUES
('Juan Dela Cruz', 'juan@example.ph', crypt('client123', gen_salt('bf')), 'client', NOW()),
('Maria Santos',   'maria@example.ph', crypt('client123', gen_salt('bf')), 'client', NOW()),
('Ana Cruz',       'ana@example.ph',  crypt('client123', gen_salt('bf')), 'client', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO reviews (product_id, user_id, rating, title, comment, status, is_verified_purchase)
SELECT p.id, u.id, r.rating, r.title, r.comment, 'approved', TRUE
FROM (VALUES
    ('Full Synthetic 5W-30', 'juan@example.ph',  5, 'Spotless after 3 months', 'Engine runs quiet and the consumption dropped noticeably. Will keep buying this one.'),
    ('Full Synthetic 5W-30', 'maria@example.ph', 5, 'Worth every peso', 'Great protection for my turbo car. Delivery was fast and the packaging was sealed.'),
    ('Full Synthetic 5W-30', 'ana@example.ph',  4, 'Good oil', 'No complaints at all, slightly thicker than I am used to but the engine is happy.'),
    ('High Mileage 0W-20',  'maria@example.ph', 5, 'Stopped the leaks', 'My 120k km engine stopped burning oil after one bottle. Impressive.'),
    ('High Mileage 0W-20',  'juan@example.ph',  4, 'Smooth idle', 'Noticeably smoother and the oil consumption is better than before.'),
    ('Diesel Blend 10W-40',  'maria@example.ph', 5, 'Built for the truck', 'Runs my Isuzu D-Max fine on long hauls. No foaming in the summer heat.'),
    ('Diesel Blend 10W-40',  'juan@example.ph',  5, 'Heavy duty performer', 'Exactly what a diesel needs. Thick enough for the load and still clean on pickup.'),
    ('Castrol EDGE 5W-30',  'maria@example.ph', 4, 'Solid', 'Standard premium oil, no surprises. Good value.'),
    ('Shell Helix 5W-40',   'juan@example.ph',  4, 'Good cleaning power', 'Cleaned up some sludge after switching from an unknown brand.'),
    ('Liqui Moly 0W-30',    'maria@example.ph', 5, 'Great for turbo', 'Excellent for a turbocharged engine. Low friction and quick response.')
) AS r(product_name, email, rating, title, comment)
JOIN products p ON p.name = r.product_name
JOIN users    u ON u.email = r.email
ON CONFLICT (product_id, user_id) DO NOTHING;

-- Refresh denormalised aggregates for any product seeded above.
UPDATE products p
SET rating_avg = COALESCE(a.avg_rating, 0),
    rating_count = COALESCE(a.total, 0)
FROM (
    SELECT product_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*) AS total
    FROM reviews WHERE status = 'approved' GROUP BY product_id
) a
WHERE a.product_id = p.id;

COMMIT;

-- ---------------------------------------------------------------------------
-- Sanity check
-- ---------------------------------------------------------------------------
-- 
-- === TorqueLine seed summary ===
SELECT 'brands'       AS entity, COUNT(*) FROM brands
UNION ALL SELECT 'formulations',  COUNT(*) FROM formulations
UNION ALL SELECT 'viscosities',  COUNT(*) FROM viscosities
UNION ALL SELECT 'products',     COUNT(*) FROM products
UNION ALL SELECT 'payment_methods', COUNT(*) FROM payment_methods
UNION ALL SELECT 'promotions',   COUNT(*) FROM promotions
UNION ALL SELECT 'users',        COUNT(*) FROM users
UNION ALL SELECT 'reviews',      COUNT(*) FROM reviews
ORDER BY entity;

-- 
-- === Admin login ===
-- email: admin@torqueline.ph   password: admin123
-- 
-- === Sample rating output (product_id | avg | count) ===
SELECT product_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*) AS review_count
FROM reviews WHERE status = 'approved'
GROUP BY product_id ORDER BY avg_rating DESC, review_count DESC;
