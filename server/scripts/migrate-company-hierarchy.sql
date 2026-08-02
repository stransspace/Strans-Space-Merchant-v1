-- =======================================================
-- MIGRATION SCRIPT: MULTI-TENANT HIERARCHICAL (COMPANY & BRANCHES)
-- =======================================================

-- 1. Buat tabel companies (Entitas Bisnis Utama)
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    subscription_plan VARCHAR(50) DEFAULT 'free', -- 'free', 'standard', 'premium'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Buat Company Default (ID = 1) untuk menampung data migrasi
INSERT INTO companies (id, name, subscription_plan) 
VALUES (1, 'My Business Group (Default)', 'premium')
ON DUPLICATE KEY UPDATE name=name;

-- 3. Tambahkan kolom company_id ke tabel tenants (yang sekarang bertindak sebagai Cabang/Outlet)
-- Kita bungkus dalam prosedur agar aman dijalankan berulang kali (idempotent)
DELIMITER //
CREATE PROCEDURE AddCompanyIdToTenants()
BEGIN
    DECLARE column_exists INT;
    
    SELECT COUNT(*) INTO column_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tenants' 
      AND COLUMN_NAME = 'company_id';
      
    IF column_exists = 0 THEN
        ALTER TABLE tenants ADD COLUMN company_id INT NOT NULL DEFAULT 1;
        ALTER TABLE tenants ADD CONSTRAINT fk_tenants_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX idx_tenants_company ON tenants(company_id);
    END IF;
END //
DELIMITER ;

CALL AddCompanyIdToTenants();
DROP PROCEDURE IF EXISTS AddCompanyIdToTenants;

-- 4. Tambahkan kolom company_id ke tabel menu_items dan materials untuk manajemen katalog terpusat
DELIMITER //
CREATE PROCEDURE AddCompanyIdToCatalog()
BEGIN
    DECLARE col_menu_exists INT;
    DECLARE col_mat_exists INT;
    
    SELECT COUNT(*) INTO col_menu_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'menu_items' 
      AND COLUMN_NAME = 'company_id';
      
    IF col_menu_exists = 0 THEN
        ALTER TABLE menu_items ADD COLUMN company_id INT NOT NULL DEFAULT 1;
        ALTER TABLE menu_items ADD CONSTRAINT fk_menu_items_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX idx_menu_items_company ON menu_items(company_id);
    END IF;

    SELECT COUNT(*) INTO col_mat_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'materials' 
      AND COLUMN_NAME = 'company_id';
      
    IF col_mat_exists = 0 THEN
        ALTER TABLE materials ADD COLUMN company_id INT NOT NULL DEFAULT 1;
        ALTER TABLE materials ADD CONSTRAINT fk_materials_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        CREATE INDEX idx_materials_company ON materials(company_id);
    END IF;
END //
DELIMITER ;

CALL AddCompanyIdToCatalog();
DROP PROCEDURE IF EXISTS AddCompanyIdToCatalog;

-- 5. Sinkronkan company_id produk & bahan baku yang ada saat ini
-- Karena data awal ada di tenant_id (cabang), dan cabang tersebut mengarah ke company_id = 1
UPDATE menu_items mi 
JOIN tenants t ON mi.tenant_id = t.id 
SET mi.company_id = t.company_id;

UPDATE materials m 
JOIN tenants t ON m.tenant_id = t.id 
SET m.company_id = t.company_id;

-- 6. Buat tabel branch_menu_items (Pemetaan ketersediaan & harga produk per cabang)
CREATE TABLE IF NOT EXISTS branch_menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NOT NULL,               -- Merujuk ke tenants.id (outlet)
    menu_item_id VARCHAR(50) NOT NULL,    -- Merujuk ke menu_items.id
    is_available TINYINT(1) DEFAULT 1,     -- 1 = Dijual, 0 = Tidak dijual
    price_override INT NULL,              -- Harga kustom di cabang ini (jika null, gunakan harga utama menu_items)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_branch_menu (branch_id, menu_item_id),
    CONSTRAINT fk_bmi_branch FOREIGN KEY (branch_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_bmi_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE INDEX idx_bmi_branch ON branch_menu_items(branch_id);
CREATE INDEX idx_bmi_menu ON branch_menu_items(menu_item_id);
