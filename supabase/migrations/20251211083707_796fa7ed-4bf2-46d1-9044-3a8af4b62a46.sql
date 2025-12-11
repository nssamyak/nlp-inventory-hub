-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'warehouse_staff', 'procurement_officer');

-- Departments table
CREATE TABLE public.departments (
  d_id SERIAL PRIMARY KEY,
  d_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Roles table
CREATE TABLE public.roles (
  role_id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories table (self-referencing for hierarchy)
CREATE TABLE public.categories (
  c_id SERIAL PRIMARY KEY,
  cat_name VARCHAR(100) NOT NULL,
  parent_id INT REFERENCES public.categories(c_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employee/Profiles table
CREATE TABLE public.employees (
  e_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  f_name VARCHAR(50) NOT NULL,
  l_name VARCHAR(50) NOT NULL,
  e_name VARCHAR(100),
  d_id INT REFERENCES public.departments(d_id) ON DELETE SET NULL,
  role_id INT REFERENCES public.roles(role_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User roles table for RLS (security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Products table
CREATE TABLE public.products (
  pid SERIAL PRIMARY KEY,
  p_name VARCHAR(200) NOT NULL,
  description TEXT,
  quantity INT DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unit_price DECIMAL(10,2) DEFAULT 0,
  manufacturer VARCHAR(200),
  c_id INT REFERENCES public.categories(c_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Warehouses table
CREATE TABLE public.warehouses (
  w_id SERIAL PRIMARY KEY,
  w_name VARCHAR(100) NOT NULL,
  address TEXT,
  mgr_id UUID REFERENCES public.employees(e_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers table
CREATE TABLE public.suppliers (
  sup_id SERIAL PRIMARY KEY,
  s_name VARCHAR(200) NOT NULL,
  address TEXT,
  contact_email VARCHAR(100),
  contact_phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product_Warehouse junction table
CREATE TABLE public.product_warehouse (
  pid INT REFERENCES public.products(pid) ON DELETE CASCADE,
  w_id INT REFERENCES public.warehouses(w_id) ON DELETE CASCADE,
  stock INT DEFAULT 0,
  PRIMARY KEY (pid, w_id)
);

-- Transactions table
CREATE TABLE public.transactions (
  t_id SERIAL PRIMARY KEY,
  time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  amt INT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'take', 'return', 'transfer', 'adjustment'
  pid INT REFERENCES public.products(pid) ON DELETE SET NULL,
  w_id INT REFERENCES public.warehouses(w_id) ON DELETE SET NULL,
  target_w_id INT REFERENCES public.warehouses(w_id) ON DELETE SET NULL, -- for transfers
  e_id UUID REFERENCES public.employees(e_id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders (Purchase Orders) table
CREATE TABLE public.orders (
  po_id SERIAL PRIMARY KEY,
  quantity INT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, ordered, received, cancelled
  p_id INT REFERENCES public.products(pid) ON DELETE SET NULL,
  sup_id INT REFERENCES public.suppliers(sup_id) ON DELETE SET NULL,
  price DECIMAL(10,2),
  date DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.employees(e_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bills/Invoices metadata table (instead of NoSQL)
CREATE TABLE public.bills (
  bill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id INT REFERENCES public.suppliers(sup_id) ON DELETE SET NULL,
  order_id INT REFERENCES public.orders(po_id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  uploaded_by UUID REFERENCES public.employees(e_id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Command history for NLP console
CREATE TABLE public.command_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  command TEXT NOT NULL,
  result JSONB,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_warehouse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_history ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's app role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies

-- Departments: all authenticated users can read
CREATE POLICY "Authenticated users can read departments" ON public.departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage departments" ON public.departments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Roles: all authenticated users can read
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage roles" ON public.roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Categories: all authenticated users can read
CREATE POLICY "Authenticated users can read categories" ON public.categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Employees: users can read all, manage own
CREATE POLICY "Authenticated users can read employees" ON public.employees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own employee record" ON public.employees
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage employees" ON public.employees
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own employee record" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- User roles: admins only
CREATE POLICY "Admins can manage user_roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Products: all authenticated users can read, managers/admins can modify
CREATE POLICY "Authenticated users can read products" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers and admins can manage products" ON public.products
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- Warehouses: all authenticated users can read
CREATE POLICY "Authenticated users can read warehouses" ON public.warehouses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage warehouses" ON public.warehouses
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Suppliers: all authenticated users can read
CREATE POLICY "Authenticated users can read suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Procurement and admins can manage suppliers" ON public.suppliers
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'procurement_officer')
  );

-- Product_Warehouse: all can read, staff+ can modify
CREATE POLICY "Authenticated users can read product_warehouse" ON public.product_warehouse
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage product_warehouse" ON public.product_warehouse
  FOR ALL TO authenticated USING (true);

-- Transactions: all can read, all can insert (logged)
CREATE POLICY "Authenticated users can read transactions" ON public.transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Orders: all can read, procurement+ can manage
CREATE POLICY "Authenticated users can read orders" ON public.orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Procurement and managers can manage orders" ON public.orders
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR 
    public.has_role(auth.uid(), 'procurement_officer')
  );

-- Bills: all can read, procurement can manage
CREATE POLICY "Authenticated users can read bills" ON public.bills
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Procurement can manage bills" ON public.bills
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'procurement_officer')
  );

-- Command history: users can manage own
CREATE POLICY "Users can manage own command history" ON public.command_history
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- Create storage bucket for bills
INSERT INTO storage.buckets (id, name, public) VALUES ('bills', 'bills', false);

-- Storage policies for bills
CREATE POLICY "Authenticated users can upload bills" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'bills');

CREATE POLICY "Authenticated users can read bills" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'bills');

-- Insert default roles
INSERT INTO public.roles (role_name, permissions) VALUES
  ('Admin', '{"all": true}'::jsonb),
  ('Manager', '{"products": true, "orders": true, "transactions": true, "approve": true}'::jsonb),
  ('Warehouse Staff', '{"transactions": true, "view": true}'::jsonb),
  ('Procurement Officer', '{"orders": true, "suppliers": true, "bills": true}'::jsonb);

-- Insert default departments
INSERT INTO public.departments (d_name) VALUES
  ('Operations'),
  ('Procurement'),
  ('Management'),
  ('Administration');

-- Handle new user signup - create employee profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.employees (user_id, f_name, l_name, e_name, role_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', 'New'),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', 'User'),
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', 'New') || ' ' || COALESCE(NEW.raw_user_meta_data ->> 'last_name', 'User'),
    3 -- Default to warehouse staff role
  );
  -- Default role assignment
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'warehouse_staff');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_warehouse;