-- ============================================================================
-- TorqueLine — MySQL 8 schema
-- Direct port of db/schema.sql (PostgreSQL). Same tables, columns, relations.
--
-- Run: mysql -u root -p torqueline < db/mysql/01_schema.sql
--
-- Deltas from the Postgres version:
--   BIGSERIAL        -> BIGINT UNSIGNED AUTO_INCREMENT
--   NUMERIC          -> DECIMAL
--   JSONB            -> JSON
--   TIMESTAMPTZ      -> TIMESTAMP
--   INET             -> VARCHAR(45)
--   native ENUM      -> VARCHAR + CHECK (portable, easier to extend)
--   FILTER clause    -> SUM(CASE WHEN ...)
--   partial index    -> full index (MySQL has no partial indexes)
--   crypt()/gen_salt -> pre-computed bcrypt hash
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Drop in reverse-dependency order (safe to re-run during development)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS review_images;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS user_addresses;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS promotion_products;
DROP TABLE IF EXISTS promotions;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS viscosities;
DROP TABLE IF EXISTS formulations;
DROP TABLE IF EXISTS brands;
DROP TABLE IF EXISTS payment_methods;

DROP VIEW IF EXISTS v_admin_metrics;
DROP VIEW IF EXISTS v_order_summary;
DROP VIEW IF EXISTS v_product_catalogue;
DROP VIEW IF EXISTS v_product_ratings;

SET FOREIGN_KEY_CHECKS = 1;

-- ===========================================================================
-- 1. CATALOG
-- ===========================================================================
CREATE TABLE brands (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    slug        VARCHAR(140) NOT NULL,
    logo_path   VARCHAR(255) NULL,
    description TEXT NULL,
    country     VARCHAR(80)  NULL,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_brands_name (name),
    UNIQUE KEY uq_brands_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE formulations (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    slug        VARCHAR(140) NOT NULL,
    oil_type    VARCHAR(20)  NOT NULL COMMENT 'synthetic|semi_synthetic|mineral|blend',
    base_oil    VARCHAR(80)  NULL,
    description TEXT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_formulations_name (name),
    UNIQUE KEY uq_formulations_slug (slug),
    CONSTRAINT ck_formulations_oil_type
        CHECK (oil_type IN ('synthetic','semi_synthetic','mineral','blend'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE viscosities (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    grade           VARCHAR(20)  NOT NULL,
    cold_rating     SMALLINT UNSIGNED NOT NULL,
    hot_rating      SMALLINT UNSIGNED NOT NULL,
    viscosity_index SMALLINT UNSIGNED NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_viscosities_grade (grade),
    CONSTRAINT ck_viscosities_cold CHECK (cold_rating BETWEEN 0 AND 60),
    CONSTRAINT ck_viscosities_hot  CHECK (hot_rating  BETWEEN 0 AND 60)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
    id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    brand_id               BIGINT UNSIGNED NOT NULL,
    formulation_id         BIGINT UNSIGNED NOT NULL,
    viscosity_id           BIGINT UNSIGNED NOT NULL,
    sku                    VARCHAR(64)  NOT NULL,
    name                   VARCHAR(200) NOT NULL,
    slug                   VARCHAR(220) NOT NULL,
    short_description      VARCHAR(300) NULL,
    description            TEXT NULL,
    volume_liters          DECIMAL(6,2)  NOT NULL DEFAULT 4.00,
    api_spec               VARCHAR(120) NULL,
    price_php              DECIMAL(10,2) NOT NULL,
    compare_at_price_php   DECIMAL(10,2) NULL,
    image_path             VARCHAR(255) NULL,
    gallery                JSON NOT NULL,
    stock_qty              INT NOT NULL DEFAULT 0,
    low_stock_threshold    INT NOT NULL DEFAULT 5,
    is_active              TINYINT(1) NOT NULL DEFAULT 1,
    rating_avg             DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    rating_count           INT NOT NULL DEFAULT 0,
    attributes             JSON NOT NULL,
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_products_sku (sku),
    UNIQUE KEY uq_products_slug (slug),
    KEY idx_products_brand (brand_id),
    KEY idx_products_formulation (formulation_id),
    KEY idx_products_viscosity (viscosity_id),
    KEY idx_products_active_price (is_active, price_php),
    KEY idx_products_rating (rating_avg DESC, rating_count DESC),
    CONSTRAINT fk_products_brand       FOREIGN KEY (brand_id)       REFERENCES brands(id)       ON DELETE RESTRICT,
    CONSTRAINT fk_products_formulation FOREIGN KEY (formulation_id) REFERENCES formulations(id) ON DELETE RESTRICT,
    CONSTRAINT fk_products_viscosity   FOREIGN KEY (viscosity_id)   REFERENCES viscosities(id)   ON DELETE RESTRICT,
    CONSTRAINT ck_products_price   CHECK (price_php >= 0),
    CONSTRAINT ck_products_stock   CHECK (stock_qty >= 0),
    CONSTRAINT ck_products_compare CHECK (compare_at_price_php IS NULL OR compare_at_price_php >= price_php),
    CONSTRAINT ck_products_rating  CHECK (rating_avg BETWEEN 0 AND 5),
    CONSTRAINT ck_products_ratingc CHECK (rating_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promotions (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(160) NOT NULL,
    code            VARCHAR(40)  NULL,
    discount_type   VARCHAR(10)  NOT NULL COMMENT 'percent|fixed',
    discount_value  DECIMAL(10,2) NOT NULL,
    starts_at       TIMESTAMP NULL,
    ends_at         TIMESTAMP NULL,
    min_order_php   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    max_redemptions INT NULL,
    usage_count     INT NOT NULL DEFAULT 0,
    banner_image    VARCHAR(255) NULL,
    headline        VARCHAR(200) NULL,
    subheadline     VARCHAR(300) NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_promotions_code (code),
    KEY idx_promotions_active (is_active, starts_at, ends_at),
    CONSTRAINT ck_promotions_type   CHECK (discount_type IN ('percent','fixed')),
    CONSTRAINT ck_promotions_value  CHECK (discount_value > 0),
    CONSTRAINT ck_promotions_window CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
    CONSTRAINT ck_promotions_uses   CHECK (max_redemptions IS NULL OR usage_count <= max_redemptions)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promotion_products (
    promotion_id BIGINT UNSIGNED NOT NULL,
    product_id   BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (promotion_id, product_id),
    KEY idx_promo_products_product (product_id),
    CONSTRAINT fk_promo_products_promo   FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
    CONSTRAINT fk_promo_products_product FOREIGN KEY (product_id)   REFERENCES products(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 2. IDENTITY
-- ===========================================================================
CREATE TABLE users (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name              VARCHAR(160) NOT NULL,
    email             VARCHAR(190) NOT NULL,
    password_hash     VARCHAR(255) NOT NULL COMMENT 'bcrypt/Argon2 digest, never plaintext',
    phone             VARCHAR(32)  NULL,
    role              VARCHAR(20)  NOT NULL DEFAULT 'client' COMMENT 'client|admin|distributor',
    avatar_url        VARCHAR(255) NULL,
    is_active         TINYINT(1)   NOT NULL DEFAULT 1,
    email_verified_at TIMESTAMP    NULL,
    last_login_at     TIMESTAMP    NULL,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role (role),
    CONSTRAINT ck_users_role CHECK (role IN ('client','admin','distributor'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_addresses (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id        BIGINT UNSIGNED NOT NULL,
    recipient_name VARCHAR(160) NOT NULL,
    phone          VARCHAR(32)  NULL,
    region         VARCHAR(80)  NULL,
    province       VARCHAR(80)  NULL,
    city           VARCHAR(120) NULL,
    barangay       VARCHAR(160) NULL,
    street         VARCHAR(255) NULL,
    postal_code    VARCHAR(16)  NULL,
    is_default     TINYINT(1)   NOT NULL DEFAULT 0,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_addresses_user (user_id),
    CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sessions (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT UNSIGNED NOT NULL,
    token_hash VARCHAR(128) NOT NULL COMMENT 'sha256 of the cookie token',
    ip_address VARCHAR(45)  NULL,
    user_agent VARCHAR(400) NULL,
    expires_at TIMESTAMP    NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sessions_token (token_hash),
    KEY idx_sessions_user_expiry (user_id, expires_at),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 3. COMMERCE
-- ===========================================================================
CREATE TABLE payment_methods (
    id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code               VARCHAR(40)  NOT NULL COMMENT 'gcash|maya|shopeepay|card|bank|cod',
    name               VARCHAR(120) NOT NULL,
    provider           VARCHAR(120) NULL,
    logo_path          VARCHAR(255) NULL,
    requires_reference TINYINT(1)   NOT NULL DEFAULT 0,
    is_active          TINYINT(1)   NOT NULL DEFAULT 1,
    sort_order         INT NOT NULL DEFAULT 0,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_payment_methods_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE carts (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id       BIGINT UNSIGNED NULL,
    session_token VARCHAR(128) NULL COMMENT 'guest carts',
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_carts_session (session_token),
    KEY idx_carts_user (user_id),
    CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cart_items (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    cart_id        BIGINT UNSIGNED NOT NULL,
    product_id     BIGINT UNSIGNED NOT NULL,
    quantity       INT NOT NULL,
    unit_price_php DECIMAL(10,2) NOT NULL,
    added_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cart_items (cart_id, product_id),
    KEY idx_cart_items_product (product_id),
    CONSTRAINT fk_cart_items_cart    FOREIGN KEY (cart_id)    REFERENCES carts(id)    ON DELETE CASCADE,
    CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT ck_cart_items_qty   CHECK (quantity > 0),
    CONSTRAINT ck_cart_items_price CHECK (unit_price_php >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_number      VARCHAR(32) NOT NULL,
    user_id           BIGINT UNSIGNED NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_status    VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    payment_method_id BIGINT UNSIGNED NULL,
    promotion_id      BIGINT UNSIGNED NULL,
    subtotal_php      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    shipping_php      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount_php      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax_php           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_php         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    shipping_address  JSON NULL,
    billing_address   JSON NULL,
    notes             TEXT NULL,
    placed_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at           TIMESTAMP NULL,
    shipped_at        TIMESTAMP NULL,
    delivered_at      TIMESTAMP NULL,
    cancelled_at      TIMESTAMP NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_orders_number (order_number),
    KEY idx_orders_user (user_id),
    KEY idx_orders_status (status),
    KEY idx_orders_placed_at (placed_at),
    KEY idx_orders_payment_status (payment_status),
    CONSTRAINT fk_orders_user           FOREIGN KEY (user_id)           REFERENCES users(id)            ON DELETE SET NULL,
    CONSTRAINT fk_orders_payment_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_promotion      FOREIGN KEY (promotion_id)      REFERENCES promotions(id)       ON DELETE SET NULL,
    CONSTRAINT ck_orders_status CHECK (status IN
        ('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded')),
    CONSTRAINT ck_orders_payment_status CHECK (payment_status IN
        ('unpaid','authorized','paid','failed','refunded')),
    CONSTRAINT ck_orders_amounts CHECK (subtotal_php >= 0 AND shipping_php >= 0
        AND discount_php >= 0 AND tax_php >= 0 AND total_php >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id       BIGINT UNSIGNED NOT NULL,
    product_id     BIGINT UNSIGNED NULL,
    product_name   VARCHAR(200) NOT NULL COMMENT 'snapshot',
    sku            VARCHAR(64)  NULL COMMENT 'snapshot',
    image_path     VARCHAR(255) NULL COMMENT 'snapshot',
    unit_price_php DECIMAL(10,2) NOT NULL,
    quantity       INT NOT NULL,
    line_total_php DECIMAL(10,2) NOT NULL,
    KEY idx_order_items_order (order_id),
    KEY idx_order_items_product (product_id),
    CONSTRAINT fk_order_items_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT ck_order_items_qty   CHECK (quantity > 0),
    CONSTRAINT ck_order_items_price CHECK (unit_price_php >= 0 AND line_total_php >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_status_history (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id    BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(20) NULL,
    to_status   VARCHAR(20) NOT NULL,
    note        VARCHAR(300) NULL,
    changed_by  BIGINT UNSIGNED NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_order_history_order (order_id, created_at),
    CONSTRAINT fk_order_history_order   FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_history_changed FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id            BIGINT UNSIGNED NOT NULL,
    payment_method_id   BIGINT UNSIGNED NOT NULL,
    provider_reference  VARCHAR(160) NULL,
    amount_php          DECIMAL(10,2) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'initiated',
    amount_refunded_php DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    paid_at             TIMESTAMP NULL,
    payload             JSON NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_payments_order (order_id),
    KEY idx_payments_status (status),
    CONSTRAINT fk_payments_order            FOREIGN KEY (order_id)          REFERENCES orders(id)          ON DELETE CASCADE,
    CONSTRAINT fk_payments_payment_method   FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT,
    CONSTRAINT ck_payments_status CHECK (status IN ('initiated','pending','succeeded','failed','refunded')),
    CONSTRAINT ck_payments_amount CHECK (amount_php >= 0 AND amount_refunded_php >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 4. SOCIAL PROOF
-- ===========================================================================
CREATE TABLE reviews (
    id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    product_id           BIGINT UNSIGNED NOT NULL,
    user_id              BIGINT UNSIGNED NOT NULL,
    order_item_id        BIGINT UNSIGNED NULL,
    rating               SMALLINT UNSIGNED NOT NULL,
    title                VARCHAR(160) NULL,
    comment              TEXT NULL,
    status               VARCHAR(16) NOT NULL DEFAULT 'pending',
    is_verified_purchase TINYINT(1)   NOT NULL DEFAULT 0,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_reviews_product_user (product_id, user_id),
    KEY idx_reviews_user (user_id),
    KEY idx_reviews_product_status (product_id, status),
    KEY idx_reviews_created (created_at),
    CONSTRAINT fk_reviews_product    FOREIGN KEY (product_id)    REFERENCES products(id)   ON DELETE CASCADE,
    CONSTRAINT fk_reviews_user       FOREIGN KEY (user_id)       REFERENCES users(id)      ON DELETE CASCADE,
    CONSTRAINT fk_reviews_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
    CONSTRAINT ck_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT ck_reviews_status CHECK (status IN ('pending','approved','rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE review_images (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    review_id  BIGINT UNSIGNED NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    KEY idx_review_images_review (review_id),
    CONSTRAINT fk_review_images_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 5. TRIGGERS
-- ===========================================================================

DELIMITER $$

-- Keep products.rating_avg / rating_count in sync with approved reviews.
CREATE TRIGGER trg_reviews_after_insert AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
    UPDATE products p
    SET p.rating_avg = COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews
                                 WHERE product_id = NEW.product_id AND status = 'approved'), 0),
        p.rating_count = (SELECT COUNT(*) FROM reviews
                          WHERE product_id = NEW.product_id AND status = 'approved')
    WHERE p.id = NEW.product_id;
END$$

CREATE TRIGGER trg_reviews_after_update AFTER UPDATE ON reviews
FOR EACH ROW
BEGIN
    UPDATE products p
    SET p.rating_avg = COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews
                                 WHERE product_id = NEW.product_id AND status = 'approved'), 0),
        p.rating_count = (SELECT COUNT(*) FROM reviews
                          WHERE product_id = NEW.product_id AND status = 'approved')
    WHERE p.id = NEW.product_id;
    -- product_id may have changed: refresh the old product too
    IF NOT (OLD.product_id <=> NEW.product_id) THEN
        UPDATE products p
        SET p.rating_avg = COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews
                                     WHERE product_id = OLD.product_id AND status = 'approved'), 0),
            p.rating_count = (SELECT COUNT(*) FROM reviews
                              WHERE product_id = OLD.product_id AND status = 'approved')
        WHERE p.id = OLD.product_id;
    END IF;
END$$

CREATE TRIGGER trg_reviews_after_delete AFTER DELETE ON reviews
FOR EACH ROW
BEGIN
    UPDATE products p
    SET p.rating_avg = COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews
                                 WHERE product_id = OLD.product_id AND status = 'approved'), 0),
        p.rating_count = (SELECT COUNT(*) FROM reviews
                          WHERE product_id = OLD.product_id AND status = 'approved')
    WHERE p.id = OLD.product_id;
END$$

-- Record every order status change in the audit trail.
CREATE TRIGGER trg_orders_after_status_update AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF NOT (NEW.status <=> OLD.status) THEN
        INSERT INTO order_status_history (order_id, from_status, to_status)
        VALUES (OLD.id, OLD.status, NEW.status);
    END IF;
END$$

-- Guarantee at most one default address per user.
CREATE TRIGGER trg_addresses_before_insert BEFORE INSERT ON user_addresses
FOR EACH ROW
BEGIN
    IF NEW.is_default = 1 THEN
        UPDATE user_addresses SET is_default = 0 WHERE user_id = NEW.user_id;
    END IF;
END$$

DELIMITER ;

-- ===========================================================================
-- 6. VIEWS
-- ===========================================================================

-- Dynamic star ratings, e.g. "4.9/5 based on 2,847 reviews".
CREATE VIEW v_product_ratings AS
SELECT
    r.product_id,
    ROUND(AVG(r.rating), 2)                     AS avg_rating,
    COUNT(*)                                     AS review_count,
    SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS five_star,
    SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS four_star,
    SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS three_star,
    SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS two_star,
    SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS one_star
FROM reviews r
WHERE r.status = 'approved'
GROUP BY r.product_id;

-- Full catalogue row, ready for the storefront.
CREATE VIEW v_product_catalogue AS
SELECT
    p.id AS product_id, p.sku, p.name, p.slug, p.short_description, p.description,
    p.price_php, p.compare_at_price_php,
    CASE WHEN p.compare_at_price_php IS NOT NULL AND p.compare_at_price_php > p.price_php
         THEN ROUND((1 - (p.price_php / p.compare_at_price_php)) * 100, 0) ELSE 0 END AS discount_percent,
    p.image_path, p.gallery, p.stock_qty, p.is_active,
    p.rating_avg, p.rating_count,
    b.id AS brand_id, b.name AS brand_name, b.logo_path AS brand_logo,
    f.id AS formulation_id, f.name AS formulation_name, f.oil_type,
    v.id AS viscosity_id, v.grade AS viscosity_grade, v.viscosity_index,
    p.volume_liters, p.api_spec, p.attributes
FROM products p
JOIN brands       b ON b.id = p.brand_id
JOIN formulations f ON f.id = p.formulation_id
JOIN viscosities  v ON v.id = p.viscosity_id;

-- Order header with customer details.
CREATE VIEW v_order_summary AS
SELECT
    o.id, o.order_number, o.status, o.payment_status,
    pm.name AS payment_method,
    u.id AS user_id, u.name AS customer_name, u.email AS customer_email,
    o.subtotal_php, o.shipping_php, o.discount_php, o.tax_php, o.total_php,
    o.placed_at, o.paid_at, o.shipped_at, o.delivered_at,
    (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
    (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS unit_count
FROM orders o
LEFT JOIN users u            ON u.id  = o.user_id
LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id;

-- Admin dashboard headline metrics.
CREATE VIEW v_admin_metrics AS
SELECT
    (SELECT COUNT(*) FROM orders)                                                AS total_orders,
    (SELECT COALESCE(SUM(total_php), 0) FROM orders WHERE status <> 'cancelled') AS revenue_php,
    (SELECT COUNT(*) FROM users WHERE role = 'client')                           AS registered_clients,
    (SELECT COUNT(*) FROM reviews WHERE status = 'approved')                     AS published_reviews,
    (SELECT ROUND(AVG(rating), 2) FROM reviews WHERE status = 'approved')        AS avg_rating,
    (SELECT COUNT(*) FROM products WHERE is_active AND stock_qty <= low_stock_threshold) AS low_stock_products;
