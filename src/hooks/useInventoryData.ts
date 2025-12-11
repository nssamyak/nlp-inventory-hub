import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { 
  Product, 
  Warehouse, 
  Supplier, 
  Category, 
  Order, 
  Transaction,
  ProductWarehouse 
} from '@/types/inventory';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .order('p_name');
    
    if (!error && data) {
      setProducts(data as Product[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
    
    const channel = supabase
      .channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchProducts)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { products, loading, refetch: fetchProducts };
}

export function useWarehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWarehouses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .order('w_name');
    
    if (!error && data) {
      setWarehouses(data as Warehouse[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  return { warehouses, loading, refetch: fetchWarehouses };
}

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('s_name');
    
    if (!error && data) {
      setSuppliers(data as Supplier[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  return { suppliers, loading, refetch: fetchSuppliers };
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('cat_name');
    
    if (!error && data) {
      setCategories(data as Category[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return { categories, loading, refetch: fetchCategories };
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, product:products(*), supplier:suppliers(*)')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { orders, loading, refetch: fetchOrders };
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*, product:products(*)')
      .order('time', { ascending: false })
      .limit(100);
    
    if (!error && data) {
      setTransactions(data as unknown as Transaction[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTransactions();

    const channel = supabase
      .channel('transactions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchTransactions)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { transactions, loading, refetch: fetchTransactions };
}

export function useProductStock() {
  const [stock, setStock] = useState<ProductWarehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStock = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('product_warehouse')
      .select('*, product:products(*), warehouse:warehouses(*)')
      .order('pid');
    
    if (!error && data) {
      setStock(data as ProductWarehouse[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStock();

    const channel = supabase
      .channel('stock-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_warehouse' }, fetchStock)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { stock, loading, refetch: fetchStock };
}
