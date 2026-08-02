CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  price INT NOT NULL,
  cost_price INT NULL DEFAULT 0,
  category VARCHAR(50) NOT NULL,
  tag VARCHAR(50) NULL,
  materials TEXT NULL,
  image_url VARCHAR(255) NULL,
  is_active TINYINT(1) DEFAULT 1,
  tenant_id INT NULL,
  product_type ENUM('recipe','stock','service') NOT NULL DEFAULT 'recipe',
  unit_label VARCHAR(30) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  unit VARCHAR(20) NOT NULL,
  price DECIMAL(10,2) DEFAULT 0,
  tenant_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id VARCHAR(50) NOT NULL,
  material_id INT NOT NULL,
  qty DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_material_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_material_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS variants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_variant_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS branch_stock_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  menu_item_id VARCHAR(50) NOT NULL,
  stock DECIMAL(10,2) DEFAULT 0,
  stock_min DECIMAL(10,2) DEFAULT 0,
  UNIQUE KEY unique_branch_stock_item (branch_id, menu_item_id),
  CONSTRAINT fk_branch_stock_item_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cash INT NOT NULL DEFAULT 0,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'tunai',
  table_number VARCHAR(30) NULL,
  customer_name VARCHAR(120) NULL,
  order_type VARCHAR(30) NULL DEFAULT 'kasir',
  order_status VARCHAR(30) NULL DEFAULT 'paid',
  notes VARCHAR(255) NULL,
  tenant_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id VARCHAR(50) NOT NULL,
  variant_id INT NULL,
  qty INT NOT NULL,
  price_each INT NOT NULL,
  discount_each INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  CONSTRAINT fk_variant FOREIGN KEY (variant_id) REFERENCES variants(id)
);

INSERT INTO menu_items (id, name, price, category, tag, image_url) VALUES
  ('cf-latte', 'Caffe Latte', 32000, 'Kopi', 'Signature', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80'),
  ('cf-esp', 'Espresso', 18000, 'Kopi', 'Single', 'https://images.unsplash.com/photo-1510626176961-4b37d0b4e904?auto=format&fit=crop&w=600&q=80'),
  ('cf-capp', 'Cappuccino', 30000, 'Kopi', 'Foamy', 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=600&q=80'),
  ('cf-mocha', 'Mocha', 34000, 'Kopi', 'Cokelat', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80'),
  ('cf-v60', 'V60 Manual Brew', 38000, 'Manual Brew', 'Filter', 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=600&q=80'),

  ('cf-kopi-susu', 'Kopi Susu Gula Aren', 28000, 'Kopi', 'Favorit', 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=600&q=80'),
  ('cf-vanilla', 'Vanilla Latte', 33000, 'Kopi', 'Manis', 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80'),
  ('cf-caramel', 'Caramel Macchiato', 36000, 'Kopi', 'Caramel', 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=600&q=80'),
  ('cf-iced-tea', 'Iced Tea', 18000, 'Non Kopi', 'Segar', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80'),
  ('cf-lemon-tea', 'Lemon Tea', 20000, 'Non Kopi', 'Citrus', 'https://images.unsplash.com/photo-1544145945-f90425340c7b?auto=format&fit=crop&w=600&q=80'),
  ('cf-matcha', 'Matcha Latte', 34000, 'Non Kopi', 'Creamy', 'https://images.unsplash.com/photo-1464306076886-da185f07b8bb?auto=format&fit=crop&w=600&q=80'),
  ('cf-choco', 'Iced Chocolate', 32000, 'Non Kopi', 'Cokelat', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80'),
  ('fd-croissant', 'Croissant Butter', 24000, 'Pastry', 'Oven', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80'),
  ('fd-brownie', 'Brownies', 26000, 'Pastry', 'Fudgy', 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?auto=format&fit=crop&w=600&q=80'),
  ('fd-cheese', 'Cheese Cake', 32000, 'Cake', 'Creamy', 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?auto=format&fit=crop&w=600&q=80'),
  ('fd-sandwich', 'Chicken Sandwich', 36000, 'Sandwich', 'Lapar', 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=600&q=80')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Cashier accounts
CREATE TABLE IF NOT EXISTS cashiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  pin VARCHAR(100) NOT NULL,
  pin_hash VARCHAR(255) NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'kasir',
  email VARCHAR(255) NULL,
  tenant_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cashier shifts
CREATE TABLE IF NOT EXISTS cashier_shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cashier_id INT NOT NULL,
  opening_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
  closing_cash DECIMAL(10,2) NULL,
  start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NULL,
  notes VARCHAR(255) NULL,
  CONSTRAINT fk_shift_cashier FOREIGN KEY (cashier_id) REFERENCES cashiers(id) ON DELETE CASCADE
);

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cashier_id INT NULL,
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50) NULL,
  details TEXT NULL,
  tenant_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cashier (cashier_id),
  INDEX idx_entity (entity, entity_id),
  INDEX idx_created_at (created_at),
  CONSTRAINT fk_activity_cashier FOREIGN KEY (cashier_id) REFERENCES cashiers(id) ON DELETE SET NULL
);

-- Roles (untuk group permissions)
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Modules/Features (fitur yang bisa di-akses)
CREATE TABLE IF NOT EXISTS modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  icon VARCHAR(50) NULL,
  path VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role Permissions (mapping role ke modules)
CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  module_id INT NOT NULL,
  can_view TINYINT(1) DEFAULT 0,
  can_create TINYINT(1) DEFAULT 0,
  can_edit TINYINT(1) DEFAULT 0,
  can_delete TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_role_module (role_id, module_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

-- User Module Access (directly assign modules to cashiers/users)
CREATE TABLE IF NOT EXISTS user_module_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cashier_id INT NOT NULL,
  module_id INT NOT NULL,
  can_view TINYINT(1) DEFAULT 1,
  can_create TINYINT(1) DEFAULT 0,
  can_edit TINYINT(1) DEFAULT 0,
  can_delete TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_module (cashier_id, module_id),
  CONSTRAINT fk_uma_cashier FOREIGN KEY (cashier_id) REFERENCES cashiers(id) ON DELETE CASCADE,
  CONSTRAINT fk_uma_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

-- Insert default modules
INSERT IGNORE INTO modules (name, label, description, icon, path) VALUES
  ('dashboard', 'Dashboard', 'Lihat dashboard', '📊', '/'),
  ('kasir', 'Kasir', 'Akses modul Kasir/POS', '🛒', '/kasir'),
  ('produk', 'Produk', 'Kelola produk dan varian', '📦', '/produk'),
  ('bahan_baku', 'Bahan Baku', 'Kelola bahan baku dan stok', '📝', '/bahan'),
  ('laporan_transaksi', 'Laporan Transaksi', 'Lihat laporan transaksi', '📊', '/laporan'),
  ('laporan_bahan', 'Laporan Bahan', 'Lihat laporan stok bahan', '📈', '/laporan-bahan'),
  ('laporan_pengeluaran', 'Laporan Pengeluaran', 'Lihat laporan pengeluaran', '💰', '/pengeluaran'),
  ('akun_kasir', 'Akun Kasir', 'Kelola akun kasir', '👤', '/akun-kasir'),
  ('manajemen_akses', 'Manajemen Akses', 'Atur akses user ke modul', '🔐', '/manajemen-akses'),
  ('activity_logs', 'Log Aktivitas', 'Lihat log aktivitas user', '🧾', '/activity-logs');

INSERT IGNORE INTO modules (name, label, description, icon, path) VALUES
  ('custom_ui', 'Kustom UI', 'Atur tampilan dan identitas aplikasi', 'UI', '/kustom-ui');

-- Insert default roles
INSERT IGNORE INTO roles (name, description) VALUES
  ('owner', 'Pemilik - Akses penuh ke semua fitur'),
  ('manajer', 'Manajer - Akses ke laporan dan pengeluaran'),
  ('kasir', 'Kasir - Akses hanya ke kasir dan laporan dasar');
