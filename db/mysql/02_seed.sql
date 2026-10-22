-- ============================================================================
-- TorqueLine — MySQL 8 seed data
-- Run: mysql -u root -p torqueline < db/mysql/02_seed.sql
-- Idempotent: safe to run more than once.
-- ============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO brands (name, slug, logo_path, country, description) VALUES
('TorqueLine',   'torqueline',   'brands/images_transparent.png',   'Philippines', 'House brand premium motor oil engineered for maximum engine protection.'),
('Mobil 1',      'mobil-1',      'brands/images-7_transparent.png', 'USA',         'Factory-sealed Mobil 1 range, authorised distributor stock.'),
('Castrol EDGE', 'castrol-edge', 'brands/images-6_transparent.png', 'UK',          'Castrol EDGE with Trizone technology.'),
('Shell Helix',  'shell-helix',  'brands/images-5_transparent.png', 'UK',          'Shell Helix synthetic technology oils.'),
('Total Quartz', 'total-quartz', 'brands/images-4_transparent.png', 'France',     'Total Quartz synthetic and semi-synthetic range.'),
('BP VEG',       'bp-veg',       'brands/images-2_transparent.png', 'UK',          'BP Visco Energizer technology range.'),
('ARKO Tection', 'arko-tection', 'brands/images-3_transparent.png', 'Germany',    'ARKO premium passenger car motor oils.'),
('Liqui Moly',   'liqui-moly',   'brands/images_transparent.png',   'Germany',    'German additive technology motor oils.');

-- ---------------------------------------------------------------------------
-- Formulations
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO formulations (name, slug, oil_type, base_oil, description) VALUES
('Full Synthetic',   'full-synthetic',   'synthetic',       'Group IV PAO', 'Ultimate protection for modern engines across all temperatures.'),
('High Mileage',    'high-mileage',    'synthetic',       'Group III+',   'Advanced seals and conditioners for engines over 75,000 miles.'),
('Diesel Blend',    'diesel-blend',    'blend',           'Group II+',    'Specialised for diesel engines under extreme pressure.'),
('Synthetic Blend', 'synthetic-blend', 'semi_synthetic',  'Group III',    'Balanced synthetic blend for everyday driving.'),
('Mineral',         'mineral',         'mineral',         'Group II',     'Mineral oil for older, high-mileage engines.'),
('Premium Racing',  'premium-racing',  'synthetic',       'Group V PAO',  'Track-spec fully synthetic racing oil.');

-- ---------------------------------------------------------------------------
-- Viscosities
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO viscosities (grade, cold_rating, hot_rating, viscosity_index, sort_order) VALUES
('0W-20',  0, 20,  80, 10),
('0W-30',  0, 30,  85, 20),
('5W-30',  5, 30, 120, 30),
('5W-40',  5, 40, 130, 40),
('10W-40', 10, 40, 140, 50),
('15W-40', 15, 40, 155, 60),
('20W-50', 20, 50, 170, 70);

-- ---------------------------------------------------------------------------
-- Payment methods
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO payment_methods (code, name, provider, requires_reference, sort_order) VALUES
('gcash',     'GCash',               'G-Xchange',      1, 1),
('maya',      'Maya',                'Maya',           1, 2),
('shopeepay', 'ShopeePay',           'Shopee',         1, 3),
('card',      'Credit / Debit Card', 'Visa/Mastercard',1, 4),
('bank',      'Bank Transfer',       'BPI/BDO',        1, 5),
('cod',       'Cash on Delivery',    'TorqueLine',     0, 6);

-- ---------------------------------------------------------------------------
-- Products (prices in PHP)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO products
    (brand_id, formulation_id, viscosity_id, sku, name, slug, short_description,
     description, volume_liters, api_spec, price_php, compare_at_price_php,
     image_path, stock_qty, low_stock_threshold, gallery, attributes)
SELECT b.id, f.id, v.id,
       CONCAT('TL-', UPPER(SUBSTRING(p.name, 1, 3)), '-', REPLACE(v.grade, '-', '')),
       p.name,
       LOWER(REGEXP_REPLACE(p.name, '[^a-zA-Z0-9]+', '-', 'g')),
       p.short_desc, p.description, p.vol, p.api, p.price, p.compare_at,
       p.image, p.stock, 5, JSON_ARRAY(), p.attributes
FROM (
    SELECT 'torqueline' AS brand_slug, 'full-synthetic' AS form_slug, '5W-30' AS viscosity,
           'Full Synthetic 5W-30' AS name,
           'Ultimate protection for modern engines. Optimal viscosity across all temperatures.' AS short_desc,
           'Fully synthetic Group IV PAO motor oil engineered for maximum protection in modern turbocharged and naturally aspirated engines.' AS description,
           4.00 AS vol, 'API SP-4 / GF-6A' AS api, 1399.00 AS price, NULL AS compare_at,
           'images-5-blend.png' AS image, 42 AS stock,
           JSON_OBJECT('engine_oil_spec','API SP-4','fuel_economy','high','oxidation_control','excellent') AS attributes
    UNION ALL SELECT 'torqueline','high-mileage','0W-20','High Mileage 0W-20',
           'Advanced formula for engines over 75,000 miles. Reduces oil consumption and leaks.',
           'Synthetic low-viscosity oil with advanced seal conditioners that reduce oil consumption and stop leaks in high-mileage engines.',
           4.00,'API SP-4',1549.00,NULL,'images-2-blend.png',28,
           JSON_OBJECT('engine_oil_spec','API SP-4','fuel_economy','excellent','seal_protection','advanced')
    UNION ALL SELECT 'torqueline','diesel-blend','10W-40','Diesel Blend 10W-40',
           'Specialized for diesel engines. Superior lubrication under extreme pressure conditions.',
           'High-viscosity synthetic blend built for commercial diesel engines operating under extreme cylinder pressure and extended drain intervals.',
           4.00,'API CF-4 / CK-4',1699.00,NULL,'images-3-blend.png',19,
           JSON_OBJECT('engine_oil_spec','API CK-4','soot_control','high','high_pressure','yes')
    UNION ALL SELECT 'mobil-1','full-synthetic','5W-30','Mobil 1 5W-30',
           'Factory-sealed Mobil 1 fully synthetic with Mobil 1 Extended Performance additives.',
           'Authentic factory-sealed Mobil 1 with Extended Performance additives for deposit control and sludge prevention.',
           4.00,'API SP-4 / GF-6A',1699.00,1999.00,'brands/images-7_transparent.png',15,
           JSON_OBJECT('engine_oil_spec','API SP-4','deposit_control','excellent')
    UNION ALL SELECT 'castrol-edge','full-synthetic','5W-30','Castrol EDGE 5W-30',
           'Trizone technology keeps the engine clean and protects for longer drain intervals.',
           'Castrol EDGE with Trizone technology, a three-strength molecule that binds to both metal surfaces and fluid to deliver extended protection.',
           4.00,'API SP-4 / GF-6A',1549.00,NULL,'brands/images-6_transparent.png',22,
           JSON_OBJECT('engine_oil_spec','API SP-4','trizone','yes')
    UNION ALL SELECT 'shell-helix','synthetic-blend','5W-40','Shell Helix 5W-40',
           'Shell PurePlus technology actively cleans sludge while you drive.',
           'Shell Helix HX7 with PurePlus technology that actively cleans sludge and deposits while the vehicle is running.',
           4.00,'API SP-4',1399.00,NULL,'brands/images-5_transparent.png',31,
           JSON_OBJECT('engine_oil_spec','API SP-4','active_cleaning','yes')
    UNION ALL SELECT 'total-quartz','synthetic-blend','5W-40','Total Quartz 5W-40',
           'Synthetic blend with Total Quartz 7000 performance additives.',
           'Semi-synthetic 7000-series oil engineered for long drain intervals and severe driving conditions.',
           4.00,'API SP-4',1499.00,NULL,'brands/images-4_transparent.png',12,
           JSON_OBJECT('engine_oil_spec','API SP-4','long_drain','extended')
    UNION ALL SELECT 'bp-veg','synthetic-blend','10W-40','BP Visco 3000 10W-40',
           'Visco Energizer technology for outstanding protection at low temperatures.',
           'Semi-synthetic oil with Visco Energizer molecules that cling to engine parts, reducing friction and wear even on short journeys.',
           4.00,'API SP-4',1299.00,NULL,'brands/images-2_transparent.png',26,
           JSON_OBJECT('engine_oil_spec','API SP-4','fuel_economy','good')
    UNION ALL SELECT 'arko-tection','mineral','15W-40','ARKO Luffe Tection 15W-40',
           'High-viscosity mineral oil for classic and older engines.',
           'Mineral-based engine oil designed to protect ageing engines and help reduce oil consumption on worn valve seats.',
           4.00,'API SL / CF',1149.00,NULL,'brands/images-3_transparent.png',35,
           JSON_OBJECT('engine_oil_spec','API SL','high_viscosity','yes')
    UNION ALL SELECT 'liqui-moly','premium-racing','0W-30','Liqui Moly Top Tec 4600 0W-30',
           'German full synthetic with Liqui Moly additive technology for maximum protection.',
           'Low-viscosity full synthetic with a modern additive package that reduces friction and deposits in turbocharged engines.',
           4.00,'API SP-4 / GF-6A',1849.00,2099.00,'brands/images_transparent.png',9,
           JSON_OBJECT('engine_oil_spec','API SP-4','additive_tech','liqui_moly')
) AS p(brand_slug, form_slug, viscosity, name, short_desc, description, vol, api, price, compare_at, image, stock, attributes)
JOIN brands       b ON b.slug = p.brand_slug
JOIN formulations f ON f.slug = p.form_slug
JOIN viscosities  v ON v.grade = p.viscosity;

-- ---------------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO promotions (name, code, discount_type, discount_value, starts_at, ends_at, min_order_php, max_redemptions, headline, subheadline) VALUES
('Launch Offer 20%',   'TORQUE20', 'percent', 20, NOW() - INTERVAL 7 DAY,  NOW() + INTERVAL 23 DAY, 2500.00, 500,
 '20% Off Your First Order', 'Use code TORQUE20 at checkout and save on any full synthetic oil.'),
('Voucher 10% + P100',  'TORQUE10', 'percent', 10, NOW() - INTERVAL 1 DAY,  NOW() + INTERVAL 29 DAY, 2500.00, 1000,
 'GET 10% OFF', 'Maintain Your Ride For Less. Plus a 100 peso voucher on your order.');

INSERT IGNORE INTO promotion_products (promotion_id, product_id)
SELECT pr.id, p.id
FROM promotions pr JOIN products p
  ON p.name IN ('Full Synthetic 5W-30','High Mileage 0W-20','Diesel Blend 10W-40')
WHERE pr.code = 'TORQUE10';

-- ---------------------------------------------------------------------------
-- Accounts
-- bcrypt cost 10. $2y$ and $2a$ are interchangeable for password_verify().
--   admin@torqueline.ph  -> password: admin123
--   juan/maria/ana @example.ph -> password: client123
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO users (name, email, password_hash, role, email_verified_at) VALUES
('TorqueLine Admin', 'admin@torqueline.ph',
 '$2y$10$kwKJ737VCSN21.T9OM09/.lrj9E70hiBrxbJpSAjNf9ZsmIVJ4bH2', 'admin', NOW());

INSERT IGNORE INTO users (name, email, password_hash, role, email_verified_at) VALUES
('Juan Dela Cruz', 'juan@example.ph',
 '$2y$10$PgE8DbMW/tKTSthEwKtobOSQ9lZgDub4.cKXjrXD/ZvQC39kbK/Ny', 'client', NOW()),
('Maria Santos', 'maria@example.ph',
 '$2y$10$PgE8DbMW/tKTSthEwKtobOSQ9lZgDub4.cKXjrXD/ZvQC39kbK/Ny', 'client', NOW()),
('Ana Cruz', 'ana@example.ph',
 '$2y$10$PgE8DbMW/tKTSthEwKtobOSQ9lZgDub4.cKXjrXD/ZvQC39kbK/Ny', 'client', NOW());

-- ---------------------------------------------------------------------------
-- Reviews (so the rating views return real numbers)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO reviews (product_id, user_id, rating, title, comment, status, is_verified_purchase)
SELECT p.id, u.id, r.rating, r.title, r.comment, 'approved', 1
FROM (
    SELECT 'Full Synthetic 5W-30' AS product_name, 'juan@example.ph' AS email, 5 AS rating,
           'Spotless after 3 months' AS title,
           'Engine runs quiet and the consumption dropped noticeably. Will keep buying this one.' AS comment
    UNION ALL SELECT 'Full Synthetic 5W-30','maria@example.ph',5,'Worth every peso','Great protection for my turbo car. Delivery was fast and the packaging was sealed.'
    UNION ALL SELECT 'Full Synthetic 5W-30','juan@example.ph',4,'Good oil','No complaints at all, slightly thicker than I am used to but the engine is happy.'
    UNION ALL SELECT 'High Mileage 0W-20','maria@example.ph',5,'Stopped the leaks','My 120k km engine stopped burning oil after one bottle. Impressive.'
    UNION ALL SELECT 'High Mileage 0W-20','juan@example.ph',4,'Smooth idle','Noticeably smoother and the oil consumption is better than before.'
    UNION ALL SELECT 'Diesel Blend 10W-40','maria@example.ph',5,'Built for the truck','Runs my Isuzu D-Max fine on long hauls. No foaming in the summer heat.'
    UNION ALL SELECT 'Diesel Blend 10W-40','juan@example.ph',5,'Heavy duty performer','Exactly what a diesel needs. Thick enough for the load and still clean on pickup.'
    UNION ALL SELECT 'Castrol EDGE 5W-30','maria@example.ph',4,'Solid','Standard premium oil, no surprises. Good value.'
    UNION ALL SELECT 'Shell Helix 5W-40','juan@example.ph',4,'Good cleaning power','Cleaned up some sludge after switching from an unknown brand.'
    UNION ALL SELECT 'Liqui Moly 0W-30','maria@example.ph',5,'Great for turbo','Excellent for a turbocharged engine. Low friction and quick response.'
) AS r(product_name, email, rating, title, comment)
JOIN products p ON p.name = r.product_name
JOIN users    u ON u.email = r.email;

-- Refresh denormalised aggregates (the triggers handle this live).
UPDATE products p
SET p.rating_avg = COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews
                             WHERE product_id = p.id AND status = 'approved'), 0),
    p.rating_count = (SELECT COUNT(*) FROM reviews
                      WHERE product_id = p.id AND status = 'approved');

-- ---------------------------------------------------------------------------
-- Sanity check
-- ---------------------------------------------------------------------------
SELECT 'brands' AS entity, COUNT(*) AS total FROM brands
UNION ALL SELECT 'formulations',      COUNT(*) FROM formulations
UNION ALL SELECT 'viscosities',       COUNT(*) FROM viscosities
UNION ALL SELECT 'products',          COUNT(*) FROM products
UNION ALL SELECT 'payment_methods',   COUNT(*) FROM payment_methods
UNION ALL SELECT 'promotions',        COUNT(*) FROM promotions
UNION ALL SELECT 'users',             COUNT(*) FROM users
UNION ALL SELECT 'reviews',           COUNT(*) FROM reviews;

SELECT product_id, ROUND(AVG(rating), 2) AS avg_rating, COUNT(*) AS review_count
FROM reviews WHERE status = 'approved'
GROUP BY product_id ORDER BY avg_rating DESC, review_count DESC;

-- Admin login: admin@torqueline.ph / admin123
