-- ============================================================================
-- TorqueLine — PostgreSQL schema
-- Automotive e-commerce platform: catalog, identity, orders, payments, reviews
-- Run:  psql torqueline -f db/schema.sql
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy product search

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE oil_type AS ENUM ('synthetic', 'semi_synthetic', 'mineral', 'blend');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('client', 'admin', 'distributor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'pending', 'payment_pending', 'paid', 'processing',
        'shipped', 'delivered', 'cancelled', 'refunded'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('unpaid', 'authorized', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_record_status AS ENUM ('initiated', 'pending', 'succeeded', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE discount_type AS ENUM ('percent', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- SHARED TRIGGER: keep updated_at fresh
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- 1. CATALOG
-- ===========================================================================

CREATE TABLE IF NOT EXISTS brands (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(120) NOT NULL UNIQUE,
    slug        VARCHAR(140) NOT NULL UNIQUE,
    logo_path   VARCHAR(255),
    description TEXT,
    country     VARCHAR(80),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS formulations (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(120) NOT NULL UNIQUE,
    slug        VARCHAR(140) NOT NULL UNIQUE,
    oil_type    oil_type NOT NULL,
    base_oil    VARCHAR(80),
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS viscosities (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    grade           VARCHAR(20) NOT NULL UNIQUE,          -- e.g. '15W-40'
    cold_rating     SMALLINT NOT NULL CHECK (cold_rating BETWEEN 0 AND 60),
    hot_rating      SMALLINT NOT NULL CHECK (hot_rating  BETWEEN 0 AND 60),
    viscosity_index SMALLINT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    brand_id               BIGINT NOT NULL REFERENCES brands(id)        ON DELETE RESTRICT,
    formulation_id         BIGINT NOT NULL REFERENCES formulations(id) ON DELETE RESTRICT,
    viscosity_id           BIGINT NOT NULL REFERENCES viscosities(id)   ON DELETE RESTRICT,
    sku                    VARCHAR(64)  NOT NULL UNIQUE,
    name                   VARCHAR(200) NOT NULL,
    slug                   VARCHAR(220) NOT NULL UNIQUE,
    short_description      VARCHAR(300),
    description            TEXT,
    volume_liters          NUMERIC(6,2) NOT NULL DEFAULT 4.00 CHECK (volume_liters > 0),
    api_spec               VARCHAR(120),
    price_php              NUMERIC(10,2) NOT NULL CHECK (price_php >= 0),
    compare_at_price_php   NUMERIC(10,2) CHECK (compare_at_price_php IS NULL OR compare_at_price_php >= price_php),
    image_path             VARCHAR(255),
    gallery                JSONB NOT NULL DEFAULT '[]'::jsonb,
    stock_qty              INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    low_stock_threshold    INTEGER NOT NULL DEFAULT 5,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    -- Denormalised review aggregates, maintained by trigger (see §6)
    rating_avg             NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (rating_avg BETWEEN 0 AND 5),
    rating_count           INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
    attributes             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(160) NOT NULL,
    code            VARCHAR(40)  UNIQUE,
    discount_type   discount_type NOT NULL,
    discount_value  NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    min_order_php   NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_redemptions INTEGER,
    usage_count     INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    banner_image    VARCHAR(255),
    headline        VARCHAR(200),
    subheadline     VARCHAR(300),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT promotions_window_valid CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
    CONSTRAINT promotions_redemptions_valid CHECK (max_redemptions IS NULL OR usage_count <= max_redemptions)
);

CREATE TABLE IF NOT EXISTS promotion_products (
    promotion_id BIGINT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    product_id   BIGINT NOT NULL REFERENCES products(id)   ON DELETE CASCADE,
    PRIMARY KEY (promotion_id, product_id)
);

-- ===========================================================================
-- 2. IDENTITY
-- ===========================================================================

CREATE TABLE IF NOT EXISTS users (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name              VARCHAR(160) NOT NULL,
    email             VARCHAR(190) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,       -- bcrypt / Argon2 digest, never plaintext
    phone             VARCHAR(32),
    role              user_role NOT NULL DEFAULT 'client',
    avatar_url        VARCHAR(255),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMPTZ,
    last_login_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_addresses (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_name VARCHAR(160) NOT NULL,
    phone          VARCHAR(32),
    region         VARCHAR(80),
    province       VARCHAR(80),
    city           VARCHAR(120),
    barangay       VARCHAR(160),
    street         VARCHAR(255),
    postal_code    VARCHAR(16),
    is_default     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,       -- sha256 of the cookie token
    ip_address INET,
    user_agent VARCHAR(400),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================================================
-- 3. COMMERCE
-- ===========================================================================

CREATE TABLE IF NOT EXISTS payment_methods (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code               VARCHAR(40) NOT NULL UNIQUE,  -- gcash, maya, shopeepay, card, bank, cod
    name               VARCHAR(120) NOT NULL,
    provider           VARCHAR(120),
    logo_path          VARCHAR(255),
    requires_reference BOOLEAN NOT NULL DEFAULT FALSE,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order         INTEGER NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(128) UNIQUE,             -- guest carts
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cart_id        BIGINT NOT NULL REFERENCES carts(id)    ON DELETE CASCADE,
    product_id     BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity       INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_php NUMERIC(10,2) NOT NULL CHECK (unit_price_php >= 0),
    added_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_number     VARCHAR(32) NOT NULL UNIQUE,
    user_id          BIGINT REFERENCES users(id) ON DELETE SET NULL,
    status           order_status    NOT NULL DEFAULT 'pending',
    payment_status   payment_status  NOT NULL DEFAULT 'unpaid',
    payment_method_id BIGINT REFERENCES payment_methods(id) ON DELETE SET NULL,
    promotion_id     BIGINT REFERENCES promotions(id) ON DELETE SET NULL,
    subtotal_php     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal_php  >= 0),
    shipping_php     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_php  >= 0),
    discount_php     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_php  >= 0),
    tax_php          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (tax_php       >= 0),
    total_php        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_php     >= 0),
    shipping_address JSONB,
    billing_address  JSONB,
    notes            TEXT,
    placed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at          TIMESTAMPTZ,
    shipped_at       TIMESTAMPTZ,
    delivered_at     TIMESTAMPTZ,
    cancelled_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id         BIGINT NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
    product_id       BIGINT REFERENCES products(id) ON DELETE SET NULL,
    product_name     VARCHAR(200) NOT NULL,      -- snapshot
    sku              VARCHAR(64),                -- snapshot
    image_path       VARCHAR(255),               -- snapshot
    unit_price_php   NUMERIC(10,2) NOT NULL CHECK (unit_price_php >= 0),
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    line_total_php   NUMERIC(10,2) NOT NULL CHECK (line_total_php >= 0)
);

CREATE TABLE IF NOT EXISTS order_status_history (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status order_status,
    to_status   order_status NOT NULL,
    note        VARCHAR(300),
    changed_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id            BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_method_id   BIGINT NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    provider_reference  VARCHAR(160),
    amount_php          NUMERIC(10,2) NOT NULL CHECK (amount_php >= 0),
    status              payment_record_status NOT NULL DEFAULT 'initiated',
    amount_refunded_php NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount_refunded_php >= 0),
    paid_at             TIMESTAMPTZ,
    payload             JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================================================
-- 4. SOCIAL PROOF
-- ===========================================================================

CREATE TABLE IF NOT EXISTS reviews (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id            BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id               BIGINT NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    order_item_id         BIGINT REFERENCES order_items(id) ON DELETE SET NULL,
    rating                SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title                 VARCHAR(160),
    comment               TEXT,
    status                review_status NOT NULL DEFAULT 'pending',
    is_verified_purchase  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reviews_one_per_user_product UNIQUE (product_id, user_id)
);

CREATE TABLE IF NOT EXISTS review_images (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    review_id  BIGINT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    image_path VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- ===========================================================================
-- 5. INDEXES
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_products_brand        ON products (brand_id);
CREATE INDEX IF NOT EXISTS idx_products_formulation  ON products (formulation_id);
CREATE INDEX IF NOT EXISTS idx_products_viscosity    ON products (viscosity_id);
CREATE INDEX IF NOT EXISTS idx_products_active_price ON products (is_active, price_php);
CREATE INDEX IF NOT EXISTS idx_products_stock        ON products (stock_qty) WHERE stock_qty <= low_stock_threshold;
CREATE INDEX IF NOT EXISTS idx_products_rating       ON products (rating_avg DESC, rating_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm    ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_carts_user             ON carts (user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart        ON cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product     ON cart_items (product_id);

CREATE INDEX IF NOT EXISTS idx_orders_user           ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at      ON orders (placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order     ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product   ON order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_order_history_order   ON order_status_history (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_order        ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status       ON payments (status);

CREATE INDEX IF NOT EXISTS idx_reviews_product       ON reviews (product_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_user         ON reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created       ON reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_images_review  ON review_images (review_id);

CREATE INDEX IF NOT EXISTS idx_users_email           ON users (email);
CREATE INDEX IF NOT EXISTS idx_sessions_token        ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry  ON sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotions_active     ON promotions (is_active, starts_at, ends_at);

-- ===========================================================================
-- 6. TRIGGERS
-- ===========================================================================

CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_formulations_updated_at BEFORE UPDATE ON formulations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_promotions_updated_at BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_addresses_updated_at BEFORE UPDATE ON user_addresses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Keep products.rating_avg / rating_count in sync with approved reviews.
CREATE OR REPLACE FUNCTION refresh_product_rating() RETURNS trigger AS $$
DECLARE
    target_product BIGINT;
BEGIN
    target_product := COALESCE(NEW.product_id, OLD.product_id);

    UPDATE products p
    SET rating_avg = COALESCE(agg.avg_rating, 0),
        rating_count = COALESCE(agg.total, 0)
    FROM (
        SELECT ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
               COUNT(*)                     AS total
        FROM reviews r
        WHERE r.product_id = target_product
          AND r.status = 'approved'
    ) agg
    WHERE p.id = target_product;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_refresh_rating
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION refresh_product_rating();

-- Record every order status change in the audit trail.
CREATE OR REPLACE FUNCTION log_order_status_change() RETURNS trigger AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO order_status_history (order_id, from_status, to_status)
        VALUES (OLD.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_status_history
    AFTER UPDATE OF status ON orders
    FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- Guarantee at most one default address per user.
CREATE OR REPLACE FUNCTION ensure_single_default_address() RETURNS trigger AS $$
BEGIN
    IF NEW.is_default THEN
        UPDATE user_addresses SET is_default = FALSE WHERE user_id = NEW.user_id AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_addresses_single_default
    BEFORE INSERT OR UPDATE OF is_default ON user_addresses
    FOR EACH ROW EXECUTE FUNCTION ensure_single_default_address();

-- ===========================================================================
-- 7. VIEWS
-- ===========================================================================

-- Dynamic star ratings, e.g. "4.9/5 based on 2,847 reviews".
CREATE OR REPLACE VIEW v_product_ratings AS
SELECT
    r.product_id,
    ROUND(AVG(r.rating)::numeric, 2)        AS avg_rating,
    COUNT(*)                                AS review_count,
    COUNT(*) FILTER (WHERE r.rating = 5)    AS five_star,
    COUNT(*) FILTER (WHERE r.rating = 4)    AS four_star,
    COUNT(*) FILTER (WHERE r.rating = 3)    AS three_star,
    COUNT(*) FILTER (WHERE r.rating = 2)    AS two_star,
    COUNT(*) FILTER (WHERE r.rating = 1)    AS one_star
FROM reviews r
WHERE r.status = 'approved'
GROUP BY r.product_id;

-- Full catalogue row, ready for the storefront.
CREATE OR REPLACE VIEW v_product_catalogue AS
SELECT
    p.id                AS product_id,
    p.sku,
    p.name,
    p.slug,
    p.short_description,
    p.description,
    p.price_php,
    p.compare_at_price_php,
    CASE
        WHEN p.compare_at_price_php IS NOT NULL AND p.compare_at_price_php > p.price_php
        THEN ROUND((1 - (p.price_php / p.compare_at_price_php)) * 100, 0)
        ELSE 0
    END                 AS discount_percent,
    p.image_path,
    p.gallery,
    p.stock_qty,
    p.is_active,
    p.rating_avg,
    p.rating_count,
    b.id                AS brand_id,
    b.name              AS brand_name,
    b.logo_path         AS brand_logo,
    f.id                AS formulation_id,
    f.name              AS formulation_name,
    f.oil_type,
    v.id                AS viscosity_id,
    v.grade             AS viscosity_grade,
    v.viscosity_index,
    p.volume_liters,
    p.api_spec,
    p.attributes
FROM products p
JOIN brands       b ON b.id = p.brand_id
JOIN formulations f ON f.id = p.formulation_id
JOIN viscosities  v ON v.id = p.viscosity_id;

-- Order header with customer details.
CREATE OR REPLACE VIEW v_order_summary AS
SELECT
    o.id,
    o.order_number,
    o.status,
    o.payment_status,
    pm.name AS payment_method,
    u.id    AS user_id,
    u.name  AS customer_name,
    u.email AS customer_email,
    o.subtotal_php,
    o.shipping_php,
    o.discount_php,
    o.tax_php,
    o.total_php,
    o.placed_at,
    o.paid_at,
    o.shipped_at,
    o.delivered_at,
    (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
    (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS unit_count
FROM orders o
LEFT JOIN users u           ON u.id  = o.user_id
LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id;

-- Admin dashboard headline metrics.
CREATE OR REPLACE VIEW v_admin_metrics AS
SELECT
    (SELECT COUNT(*) FROM orders)                                          AS total_orders,
    (SELECT COALESCE(SUM(total_php), 0) FROM orders WHERE status <> 'cancelled') AS revenue_php,
    (SELECT COUNT(*) FROM users WHERE role = 'client')                     AS registered_clients,
    (SELECT COUNT(*) FROM reviews WHERE status = 'approved')               AS published_reviews,
    (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE status = 'approved') AS avg_rating,
    (SELECT COUNT(*) FROM products WHERE is_active AND stock_qty <= low_stock_threshold) AS low_stock_products;

COMMIT;
