export interface Product {
  pid: number;
  p_name: string;
  description: string | null;
  quantity: number;
  last_updated: string;
  unit_price: number;
  manufacturer: string | null;
  c_id: number | null;
  created_at: string;
  category?: Category;
}

export interface Category {
  c_id: number;
  cat_name: string;
  parent_id: number | null;
  created_at: string;
}

export interface Warehouse {
  w_id: number;
  w_name: string;
  address: string | null;
  mgr_id: string | null;
  created_at: string;
  manager?: Employee;
}

export interface Supplier {
  sup_id: number;
  s_name: string;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

export interface Employee {
  e_id: string;
  user_id: string;
  f_name: string;
  l_name: string;
  e_name: string | null;
  d_id: number | null;
  role_id: number | null;
  created_at: string;
  updated_at: string;
  department?: Department;
  role?: Role;
}

export interface Department {
  d_id: number;
  d_name: string;
  created_at: string;
}

export interface Role {
  role_id: number;
  role_name: string;
  permissions: Record<string, boolean>;
  created_at: string;
}

export interface ProductWarehouse {
  pid: number;
  w_id: number;
  stock: number;
  product?: Product;
  warehouse?: Warehouse;
}

export interface Transaction {
  t_id: number;
  time: string;
  amt: number;
  type: 'take' | 'return' | 'transfer' | 'adjustment' | 'receive';
  pid: number | null;
  w_id: number | null;
  target_w_id: number | null;
  e_id: string | null;
  description: string | null;
  created_at: string;
  product?: Product;
  warehouse?: Warehouse;
  target_warehouse?: Warehouse;
  employee?: Employee;
}

export interface Order {
  po_id: number;
  quantity: number;
  status: 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled' | 'partial';
  p_id: number | null;
  sup_id: number | null;
  target_w_id: number | null;
  price: number | null;
  date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
  supplier?: Supplier;
  target_warehouse?: Warehouse;
  creator?: Employee;
}

export interface Bill {
  bill_id: string;
  supplier_id: number | null;
  order_id: number | null;
  file_url: string;
  file_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
  invoice_data: InvoiceData | null;
  supplier?: Supplier;
  order?: Order;
  uploader?: Employee;
}

export interface InvoiceData {
  line_items?: LineItem[];
  tax_rate?: number;
  tax_amount?: number;
  subtotal?: number;
  total?: number;
  payment_terms?: string;
  due_date?: string;
  invoice_number?: string;
  po_reference?: string;
  currency?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface CommandHistory {
  id: string;
  user_id: string;
  command: string;
  result: NLPResult | null;
  success: boolean;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'manager' | 'warehouse_staff' | 'procurement_officer';
}

export interface NLPResult {
  action: string;
  entity?: string;
  params?: Record<string, unknown>;
  message: string;
  data?: unknown[];
  success: boolean;
  requiresBillUpload?: boolean;
  orderId?: number;
}

export interface ConsoleMessage {
  id: string;
  type: 'input' | 'output' | 'error' | 'success' | 'warning' | 'system';
  content: string;
  timestamp: Date;
  data?: unknown[];
}

export type AppRole = 'admin' | 'manager' | 'warehouse_staff' | 'procurement_officer';
