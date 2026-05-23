"""
Extensions to the existing inventory management system for salon-specific features
This module adds salon-specific functionality while maintaining compatibility with the existing inv_mgmt system
"""

import sqlite3
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

class SalonInventoryExtensions:
    def __init__(self, db_path: str = "inventory.db"):
        self.db_path = db_path
        self.init_salon_tables()

    def get_db_connection(self):
        """Get database connection with row factory"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_salon_tables(self):
        """Initialize salon-specific tables and extend existing ones"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        # Add salon-specific columns to products table if they don't exist
        try:
            cursor.execute("ALTER TABLE products ADD COLUMN salon_category TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists

        try:
            cursor.execute("ALTER TABLE products ADD COLUMN brand TEXT")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE products ADD COLUMN size_volume TEXT")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE products ADD COLUMN is_professional_use BOOLEAN DEFAULT 0")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE products ADD COLUMN minimum_stock_level INTEGER DEFAULT 5")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE products ADD COLUMN reorder_quantity INTEGER DEFAULT 10")
        except sqlite3.OperationalError:
            pass

        # Add salon-specific columns to materials table
        try:
            cursor.execute("ALTER TABLE materials ADD COLUMN salon_category TEXT")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE materials ADD COLUMN brand TEXT")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE materials ADD COLUMN size_volume TEXT")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE materials ADD COLUMN is_professional_use BOOLEAN DEFAULT 0")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE materials ADD COLUMN minimum_stock_level REAL DEFAULT 1.0")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE materials ADD COLUMN reorder_quantity REAL DEFAULT 5.0")
        except sqlite3.OperationalError:
            pass

        # Create suppliers table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact_person TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                city TEXT,
                state TEXT,
                postal_code TEXT,
                country TEXT,
                tax_id TEXT,
                payment_terms TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Add supplier_id to products and materials
        try:
            cursor.execute("ALTER TABLE products ADD COLUMN supplier_id INTEGER")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE materials ADD COLUMN supplier_id INTEGER")
        except sqlite3.OperationalError:
            pass

        # Create foreign key constraints (SQLite doesn't support ALTER TABLE ADD CONSTRAINT easily,
        # so we'll enforce them in application logic or check during inserts/updates)

        # Create service inventory usage tracking table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS service_inventory_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_id INTEGER,
                product_id INTEGER,
                material_id INTEGER,
                quantity_used REAL NOT NULL,
                unit TEXT,
                cost_per_unit REAL,
                total_cost REAL,
                used_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (service_id) REFERENCES services (id),
                FOREIGN KEY (product_id) REFERENCES products (id),
                FOREIGN KEY (material_id) REFERENCES materials (id),
                CHECK (
                    (product_id IS NOT NULL AND material_id IS NULL) OR
                    (product_id IS NULL AND material_id IS NOT NULL)
                )
            )
        ''')

        # Create services table (if not exists from schema)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT,
                description TEXT,
                duration_minutes INTEGER,
                base_price REAL,
                is_active BOOLEAN DEFAULT 1,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()
        conn.close()

    # ============================================================================
    # SALON-SPECIFIC PRODUCT METHODS
    # ============================================================================

    def add_salon_product(self, name: str, sku: str, category: str,
                         salon_category: str = None, brand: str = None,
                         size_volume: str = None, cost_price: float = 0.0,
                         selling_price: float = 0.0, stock: int = 0,
                         minimum_stock_level: int = 5, reorder_quantity: int = 10,
                         is_professional_use: bool = False,
                         supplier_id: int = None) -> int:
        """Add a salon-specific product"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO products (
                name, sku, category, salon_category, brand, size_volume,
                cost_price, selling_price, stock, is_professional_use,
                minimum_stock_level, reorder_quantity, supplier_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            name, sku, category, salon_category, brand, size_volume,
            cost_price, selling_price, stock, is_professional_use,
            minimum_stock_level, reorder_quantity, supplier_id
        ))

        product_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return product_id

    def update_salon_product(self, product_id: int, **kwargs) -> bool:
        """Update a salon-specific product"""
        allowed_fields = {
            'name', 'sku', 'category', 'salon_category', 'brand', 'size_volume',
            'cost_price', 'selling_price', 'stock', 'is_professional_use',
            'minimum_stock_level', 'reorder_quantity', 'supplier_id'
        }

        # Filter to only allowed fields
        updates = {k: v for k, v in kwargs.items() if k in allowed_fields}

        if not updates:
            return False

        # Build SET clause
        set_clause = ', '.join([f"{k} = ?" for k in updates.keys()])
        values = list(updates.values())
        values.append(product_id)  # For WHERE clause

        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute(f'''
            UPDATE products
            SET {set_clause}, updated_date = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', values)

        affected_rows = cursor.rowcount
        conn.commit()
        conn.close()

        return affected_rows > 0

    def get_low_stock_salon_products(self) -> List[Dict]:
        """Get salon products that are below minimum stock level"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT *, (minimum_stock_level - stock) as shortage_amount
            FROM products
            WHERE stock < minimum_stock_level
            AND is_active = 1
            ORDER BY (minimum_stock_level - stock) DESC
        ''')

        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results

    def get_salon_products_by_category(self, salon_category: str) -> List[Dict]:
        """Get salon products by salon category (hair_care, styling, color, etc.)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM products
            WHERE salon_category = ? AND is_active = 1
            ORDER BY name
        ''', (salon_category,))

        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results

    # ============================================================================
    # SERVICE INVENTORY USAGE TRACKING
    # ============================================================================

    def record_product_usage(self, service_id: int, product_id: int,
                           quantity_used: float, unit: str = 'pcs',
                           cost_per_unit: float = None) -> int:
        """Record usage of a product in a service"""
        if cost_per_unit is None:
            # Get current cost from products table
            conn = self.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT cost_price FROM products WHERE id = ?", (product_id,))
            result = cursor.fetchone()
            cost_per_unit = result['cost_price'] if result else 0.0
            conn.close()

        total_cost = quantity_used * cost_per_unit

        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO service_inventory_usage (
                service_id, product_id, quantity_used, unit,
                cost_per_unit, total_cost
            ) VALUES (?, ?, ?, ?, ?, ?)
        ''', (service_id, product_id, quantity_used, unit, cost_per_unit, total_cost))

        usage_id = cursor.lastrowid

        # Update product stock
        cursor.execute('''
            UPDATE products
            SET stock = stock - ?
            WHERE id = ?
        ''', (quantity_used, product_id))

        conn.commit()
        conn.close()

        return usage_id

    def record_material_usage(self, service_id: int, material_id: int,
                            quantity_used: float, unit: str = 'pcs',
                            cost_per_unit: float = None) -> int:
        """Record usage of a material in a service"""
        if cost_per_unit is None:
            # Get current cost from materials table
            conn = self.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT unit_cost FROM materials WHERE id = ?", (material_id,))
            result = cursor.fetchone()
            cost_per_unit = result['unit_cost'] if result else 0.0
            conn.close()

        total_cost = quantity_used * cost_per_unit

        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO service_inventory_usage (
                service_id, material_id, quantity_used, unit,
                cost_per_unit, total_cost
            ) VALUES (?, ?, ?, ?, ?, ?)
        ''', (service_id, material_id, quantity_used, unit, cost_per_unit, total_cost))

        usage_id = cursor.lastrowid

        # Update material stock
        cursor.execute('''
            UPDATE materials
            SET quantity = quantity - ?
            WHERE id = ?
        ''', (quantity_used, material_id))

        conn.commit()
        conn.close()

        return usage_id

    def get_service_inventory_usage(self, service_id: int) -> List[Dict]:
        """Get inventory usage for a specific service"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT siu.*,
                   p.name as product_name,
                   m.name as material_name
            FROM service_inventory_usage siu
            LEFT JOIN products p ON siu.product_id = p.id
            LEFT JOIN materials m ON siu.material_id = m.id
            WHERE siu.service_id = ?
            ORDER BY siu.used_date DESC
        ''', (service_id,))

        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results

    # ============================================================================
    # SUPPLIER MANAGEMENT
    # ============================================================================

    def add_supplier(self, name: str, contact_person: str = None,
                   phone: str = None, email: str = None, address: str = None,
                   city: str = None, state: str = None, postal_code: str = None,
                   country: str = None, tax_id: str = None,
                   payment_terms: str = None) -> int:
        """Add a new supplier"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO suppliers (
                name, contact_person, phone, email, address,
                city, state, postal_code, country, tax_id, payment_terms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            name, contact_person, phone, email, address,
            city, state, postal_code, country, tax_id, payment_terms
        ))

        supplier_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return supplier_id

    def get_supplier_products(self, supplier_id: int) -> List[Dict]:
        """Get all products from a specific supplier"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM products
            WHERE supplier_id = ? AND is_active = 1
            ORDER BY name
        ''', (supplier_id,))

        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results

    # ============================================================================
    # REPORTING AND ANALYTICS
    # ============================================================================

    def get_inventory_turnover_report(self, days: int = 30) -> List[Dict]:
        """Get inventory turnover report for the last N days"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT
                p.id,
                p.name,
                p.sku,
                p.salon_category,
                p.brand,
                SUM(siu.quantity_used) as total_used,
                AVG(siu.quantity_used) as avg_per_use,
                COUNT(siu.id) as usage_count,
                p.stock as current_stock,
                (p.stock / NULLIF(AVG(siu.quantity_used), 0)) as days_of_stock
            FROM products p
            LEFT JOIN service_inventory_usage siu ON p.id = siu.product_id
                AND siu.used_date >= date('now', '-' || ? || ' days')
            WHERE p.is_active = 1
            GROUP BY p.id, p.name, p.sku, p.salon_category, p.brand, p.stock
            ORDER BY total_used DESC
        ''', (days,))

        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results

    def get_expiring_inventory_alerts(self, days_threshold: int = 7) -> List[Dict]:
        """Get products that need to be reordered soon"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM products
            WHERE stock <= minimum_stock_level
            AND is_active = 1
            ORDER BY (minimum_stock_level - stock) DESC
        ''')

        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results

    # ============================================================================
    # BACKWARD COMPATIBILITY METHODS
    # ============================================================================

    # These methods maintain compatibility with the existing inv_mgmt system

    def get_products(self) -> List[Dict]:
        """Get all products (backward compatible)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM products WHERE is_active = 1 ORDER BY name')
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results

    def add_product_compat(self, name: str, sku: str, category: str,
                          stock: int = 0, cost_price: float = 0.0,
                          selling_price: float = 0.0, **kwargs) -> int:
        """Add product using original inv_mgmt interface"""
        # Extract salon-specific params from kwargs
        salon_category = kwargs.get('salon_category')
        brand = kwargs.get('brand')
        size_volume = kwargs.get('size_volume')
        is_professional_use = kwargs.get('is_professional_use', False)
        minimum_stock_level = kwargs.get('minimum_stock_level', 5)
        reorder_quantity = kwargs.get('reorder_quantity', 10)
        supplier_id = kwargs.get('supplier_id')

        return self.add_salon_product(
            name=name, sku=sku, category=category,
            salon_category=salon_category, brand=brand,
            size_volume=size_volume, cost_price=cost_price,
            selling_price=selling_price, stock=stock,
            minimum_stock_level=minimum_stock_level,
            reorder_quantity=reorder_quantity,
            is_professional_use=is_professional_use,
            supplier_id=supplier_id
        )

# Example usage and testing
if __name__ == "__main__":
    # Initialize extensions
    ext = SalonInventoryExtensions("../inv_mgmt/inventory.db")

    # Add a salon-specific product
    product_id = ext.add_salon_product(
        name="Argan Oil Shampoo",
        sku="SAO001",
        category="hair_care",
        salon_category="hair_care",
        brand="Moroccanoil",
        size_volume="250ml",
        cost_price=200.0,
        selling_price=350.0,
        stock=25,
        minimum_stock_level=5,
        reorder_quantity=10,
        is_professional_use=True
    )

    print(f"Added product with ID: {product_id}")

    # Check low stock items
    low_stock = ext.get_low_stock_salon_products()
    print(f"Low stock items: {len(low_stock)}")

    # Get hair care products
    hair_care = ext.get_salon_products_by_category("hair_care")
    print(f"Hair care products: {len(hair_care)}")