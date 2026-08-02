-- =======================================================
-- MIGRATION SCRIPT: POS COFFEE -> SAAS (MULTI-TENANT)
-- =======================================================

-- 1. Buat tabel tenants (Toko/Kafe)
CREATE TABLE IF NOT EXISTS tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    domain VARCHAR(100) UNIQUE,
    activation_code VARCHAR(50) UNIQUE,
    subscription_plan VARCHAR(50) DEFAULT 'free',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Insert Default Tenant untuk menampung data toko Anda saat ini
INSERT INTO tenants (id, name, domain, activation_code, subscription_plan)
VALUES (1, 'My Coffee Shop (Default)', 'default', 'default', 'premium')
ON DUPLICATE KEY UPDATE name=name;

-- 3. Tambahkan kolom tenant_id ke tabel-tabel utama
-- Menggunakan DEFAULT 1 agar data yang sudah ada otomatis menjadi milik tenant 1

-- Tabel Kasir / Users
-- ALTER TABLE cashiers ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
-- ALTER TABLE cashiers ADD CONSTRAINT fk_cashiers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Tabel Menu Items (Produk)
ALTER TABLE menu_items ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE menu_items ADD CONSTRAINT fk_menu_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Tabel Orders
ALTER TABLE orders ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE orders ADD CONSTRAINT fk_orders_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Tabel Materials (Bahan Baku)
ALTER TABLE materials ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE materials ADD CONSTRAINT fk_materials_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Tabel Expenses (Pengeluaran)
ALTER TABLE expenses ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Tabel Material Movements
ALTER TABLE material_movements ADD COLUMN tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE material_movements ADD CONSTRAINT fk_movements_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- 4. Tambahkan Indexing (PENTING untuk SaaS karena setiap query akan di-filter berdasarkan tenant_id)
CREATE INDEX idx_menu_items_tenant ON menu_items(tenant_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_materials_tenant ON materials(tenant_id);
CREATE INDEX idx_expenses_tenant ON expenses(tenant_id);