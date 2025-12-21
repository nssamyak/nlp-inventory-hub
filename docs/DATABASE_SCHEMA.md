# Database Schema Documentation

This document describes the database schema for the Inventory Management System.

## Tables

### products
Stores product information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| pid | integer | No | auto-increment | Primary key |
| p_name | varchar | No | - | Product name |
| description | text | Yes | null | Product description |
| quantity | integer | Yes | 0 | Total quantity across all warehouses |
| unit_price | numeric | Yes | 0 | Unit price |
| manufacturer | varchar | Yes | null | Manufacturer name |
| c_id | integer | Yes | null | Foreign key to categories |
| created_at | timestamp with time zone | Yes | now() | Creation timestamp |
| last_updated | timestamp with time zone | Yes | now() | Last update timestamp |

### categories
Stores product categories with hierarchical support.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| c_id | integer | No | auto-increment | Primary key |
| cat_name | varchar | No | - | Category name |
| parent_id | integer | Yes | null | Parent category (self-reference) |
| created_at | timestamp with time zone | Yes | now() | Creation timestamp |

### warehouses
Stores warehouse locations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| w_id | integer | No | auto-increment | Primary key |
| w_name | varchar | No | - | Warehouse name |
| address | text | Yes | null | Physical address |
| mgr_id | uuid | Yes | null | Manager employee ID |
| created_at | timestamp with time zone | Yes | now() | Creation timestamp |

### suppliers
Stores supplier information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| sup_id | integer | No | auto-increment | Primary key |
| s_name | varchar | No | - | Supplier name |
| address | text | Yes | null | Supplier address |
| contact_email | varchar | Yes | null | Contact email |
| contact_phone | varchar | Yes | null | Contact phone |
| created_at | timestamp with time zone | Yes | now() | Creation timestamp |

### employees
Stores employee information linked to auth users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| e_id | uuid | No | gen_random_uuid() | Primary key |
| user_id | uuid | No | - | Foreign key to auth.users |
| f_name | varchar | No | - | First name |
| l_name | varchar | No | - | Last name |
| e_name | varchar | Yes | null | Full name (auto-generated) |
| d_id | integer | Yes | null | Department ID |
| role_id | integer | Yes | null | Role ID |
| created_at | timestamp with time zone | Yes | now() | Creation timestamp |
| updated_at | timestamp with time zone | Yes | now() | Last update timestamp |

### departments
Stores department information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| d_id | integer | No | auto-increment | Primary key |
| d_name | varchar | No | - | Department name |
| created_at | timestamp with time zone | Yes | now() | Creation timestamp |

### roles
Stores role definitions with permissions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| role_id | integer | No | auto-increment | Primary key |
| role_name | varchar | No | - | Role name |
| permissions | jsonb | Yes | '{}' | Permission object |
| created_at | timestamp with time zone | Yes | now() | Creation timestamp |

### user_roles
Maps users to application roles for RLS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary key |
| user_id | uuid | No | - | User ID from auth.users |
| role | app_role | No | - | Role enum value |

**app_role enum values:** `admin`, `manager`, `warehouse_staff`, `procurement_officer`

### product_warehouse
Junction table for product stock levels per warehouse.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| pid | integer | No | - | Product ID (composite PK) |
| w_id | integer | No | - | Warehouse ID (composite PK) |
| stock | integer | Yes | 0 | Stock quantity in this warehouse |

### orders
Stores purchase orders.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| po_id | integer | No | auto-increment | Primary key |
| quantity | integer | No | - | Ordered quantity |
| status | varchar | Yes | 'pending' | Order status |
| p_id | integer | Yes | null | Product ID |
| sup_id | integer | Yes | null | Supplier ID |
| target_w_id | integer | Yes | null | Target warehouse ID |
| price | numeric | Yes | null | Total price |
| date | date | Yes | CURRENT_DATE | Order date |
| created_by | uuid | Yes | null | Employee who created |
| created_at | timestamp with time zone | Yes | now() | Creation timestamp |
| updated_at | timestamp with time zone | Yes | now() | Last update timestamp |

**Status values:** `pending`, `approved`, `ordered`, `shipped`, `received`, `cancelled`, `reordered`, `partial`

### transactions
Stores inventory movement transactions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| t_id | integer | No | auto-increment | Primary key |
| time | timestamp with time zone | Yes | now() | Transaction time |
| amt | integer | No | - | Amount/quantity |
| type | varchar | No | - | Transaction type |
| pid | integer | Yes | null | Product ID |
| w_id | integer | Yes | null | Warehouse ID |
| target_w_id | integer | Yes | null | Target warehouse (for transfers) |
| e_id | uuid | Yes | null | Employee ID |
| description | text | Yes | null | Transaction description |
| created_at | timestamp with time zone | Yes | now() | Creation timestamp |

**Type values:** `take`, `return`, `transfer`, `adjustment`, `receive`

### bills
Stores bill/invoice records (metadata only - files stored in MongoDB).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| bill_id | uuid | No | gen_random_uuid() | Primary key |
| order_id | integer | Yes | null | Associated order ID |
| supplier_id | integer | Yes | null | Supplier ID |
| file_url | text | No | - | MongoDB document reference |
| file_type | varchar | Yes | null | MIME type |
| uploaded_by | uuid | Yes | null | Employee who uploaded |
| uploaded_at | timestamp with time zone | Yes | now() | Upload timestamp |
| notes | text | Yes | null | Additional notes |
| invoice_data | jsonb | Yes | '{}' | Parsed invoice data |

### command_history
Stores NLP command history per user.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary key |
| user_id | uuid | No | - | User ID |
| command | text | No | - | Command text |
| result | jsonb | Yes | null | Command result |
| success | boolean | Yes | true | Success flag |
| created_at | timestamp with time zone | Yes | now() | Creation timestamp |

## Foreign Key Relationships

```
products.c_id → categories.c_id
categories.parent_id → categories.c_id (self-reference)
warehouses.mgr_id → employees.e_id
employees.d_id → departments.d_id
employees.role_id → roles.role_id
product_warehouse.pid → products.pid
product_warehouse.w_id → warehouses.w_id
orders.p_id → products.pid
orders.sup_id → suppliers.sup_id
orders.target_w_id → warehouses.w_id
orders.created_by → employees.e_id
transactions.pid → products.pid
transactions.w_id → warehouses.w_id
transactions.target_w_id → warehouses.w_id
transactions.e_id → employees.e_id
bills.order_id → orders.po_id
bills.supplier_id → suppliers.sup_id
bills.uploaded_by → employees.e_id
```

## Database Functions

### has_role(_user_id uuid, _role app_role) → boolean
Checks if a user has a specific role.

### get_user_role(_user_id uuid) → app_role
Returns the role of a user.

### handle_new_user() → trigger
Trigger function that creates an employee record and default role when a new user signs up.

## Row-Level Security (RLS) Policies

All tables have RLS enabled with appropriate policies:

- **Products**: Read by all authenticated, manage by admin/manager
- **Categories**: Read by all authenticated, manage by admin
- **Warehouses**: Read by all authenticated, manage by admin
- **Suppliers**: Read by all authenticated, manage by admin/procurement
- **Orders**: Read by all authenticated, manage by admin/manager/procurement
- **Transactions**: Read/insert by all authenticated (no update/delete)
- **Bills**: Read by all authenticated, manage by admin/procurement
- **Employees**: Read by all authenticated, manage own record, admin can manage all
- **User Roles**: Read own, admin can manage all
- **Command History**: Users can only access own history

## Storage Buckets

### bills
- **Public**: No
- **Purpose**: Stores bill/invoice file references (actual files in MongoDB)
