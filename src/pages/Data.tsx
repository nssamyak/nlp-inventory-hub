import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Package, ShoppingCart, Clock, Building2, Filter, TrendingUp, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useProducts, useWarehouses, useOrders, useTransactions } from '@/hooks/useInventoryData';
import { supabase } from '@/integrations/supabase/client';
import { NavLink } from '@/components/NavLink';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ProductMovementGraph } from '@/components/ProductMovementGraph';

interface ProductStock {
  pid: number;
  w_id: number;
  stock: number;
  product: { p_name: string; unit_price: number } | null;
  warehouse: { w_name: string } | null;
}

interface BillInfo {
  bill_id: string;
  file_url: string;
  order_id: number;
}

export default function Data() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { products } = useProducts();
  const { warehouses } = useWarehouses();
  const { orders } = useOrders();
  const { transactions } = useTransactions();

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [productStock, setProductStock] = useState<ProductStock[]>([]);
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const [bills, setBills] = useState<Record<number, BillInfo>>({});
  const [loadingBill, setLoadingBill] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchProductStock();
  }, [selectedWarehouse]);

  // Fetch bills for orders
  useEffect(() => {
    const fetchBills = async () => {
      if (!orders || orders.length === 0) return;
      
      const orderIds = orders.map(o => o.po_id);
      const { data: billsData } = await supabase
        .from('bills')
        .select('bill_id, file_url, order_id')
        .in('order_id', orderIds);

      if (billsData) {
        const billMap: Record<number, BillInfo> = {};
        billsData.forEach(bill => {
          if (bill.order_id) {
            billMap[bill.order_id] = bill as BillInfo;
          }
        });
        setBills(billMap);
      }
    };

    fetchBills();
  }, [orders]);

  const handleViewBill = async (orderId: number) => {
    const bill = bills[orderId];
    if (!bill) return;

    setLoadingBill(orderId);
    try {
      const { data: signedUrl, error } = await supabase.storage
        .from('bills')
        .createSignedUrl(bill.file_url, 3600);

      if (error) throw error;
      window.open(signedUrl.signedUrl, '_blank');
    } catch (error) {
      console.error('Error getting bill URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to retrieve invoice. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingBill(null);
    }
  };

  const fetchProductStock = async () => {
    let query = supabase
      .from('product_warehouse')
      .select('*, product:products(p_name, unit_price), warehouse:warehouses(w_name)');

    if (selectedWarehouse !== 'all') {
      query = query.eq('w_id', parseInt(selectedWarehouse));
    }

    const { data } = await query;
    if (data) setProductStock(data as ProductStock[]);
  };

  const filteredOrders = orders?.filter((order) => {
    if (orderFilter === 'all') return true;
    return order.status === orderFilter;
  });

  const pendingOrders = orders?.filter((o) => o.status === 'pending');
  const completedOrders = orders?.filter((o) => o.status === 'received');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">Data View</h1>
                <p className="text-xs text-muted-foreground">Inventory Overview</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/">Console</NavLink>
              <NavLink to="/data">Data View</NavLink>
              {userRole === 'admin' && <NavLink to="/admin">Admin</NavLink>}
            </nav>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto p-4">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{products?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Warehouses</p>
                <p className="text-2xl font-bold">{warehouses?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Orders</p>
                <p className="text-2xl font-bold">{pendingOrders?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{orders?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="inventory" className="space-y-4">
          <TabsList>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="w-4 h-4" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <Clock className="w-4 h-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="movement" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Movement History
            </TabsTrigger>
          </TabsList>

          {/* Inventory Tab */}
          <TabsContent value="inventory">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Products by Warehouse</CardTitle>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Warehouses</SelectItem>
                      {warehouses?.map((w) => (
                        <SelectItem key={w.w_id} value={w.w_id.toString()}>
                          {w.w_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productStock.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No stock data found. Add products to warehouses using the NLP console.
                        </TableCell>
                      </TableRow>
                    ) : (
                      productStock.map((ps) => (
                        <TableRow key={`${ps.pid}-${ps.w_id}`}>
                          <TableCell className="font-medium">{ps.product?.p_name || 'Unknown'}</TableCell>
                          <TableCell>{ps.warehouse?.w_name || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant={ps.stock > 10 ? 'default' : ps.stock > 0 ? 'secondary' : 'destructive'}>
                              {ps.stock}
                            </Badge>
                          </TableCell>
                          <TableCell>${ps.product?.unit_price?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>${((ps.stock || 0) * (ps.product?.unit_price || 0)).toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>All Products</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>Total Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products?.map((p) => (
                      <TableRow key={p.pid}>
                        <TableCell className="font-mono text-xs">{p.pid}</TableCell>
                        <TableCell className="font-medium">{p.p_name}</TableCell>
                        <TableCell className="max-w-xs truncate">{p.description || '-'}</TableCell>
                        <TableCell>{p.manufacturer || '-'}</TableCell>
                        <TableCell>{p.quantity || 0}</TableCell>
                        <TableCell>${p.unit_price?.toFixed(2) || '0.00'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Purchase Orders</CardTitle>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={orderFilter} onValueChange={setOrderFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Orders</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="ordered">Ordered</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Qty Ordered</TableHead>
                      <TableHead>Qty Received</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders?.map((order) => (
                        <TableRow key={order.po_id}>
                          <TableCell className="font-mono">#{order.po_id}</TableCell>
                          <TableCell>{order.product?.p_name || '-'}</TableCell>
                          <TableCell>{order.supplier?.s_name || '-'}</TableCell>
                          <TableCell>{order.quantity_ordered}</TableCell>
                          <TableCell>{order.quantity_received || 0}</TableCell>
                          <TableCell>${order.price?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                order.status === 'pending'
                                  ? 'secondary'
                                  : order.status === 'received'
                                  ? 'default'
                                  : order.status === 'cancelled'
                                  ? 'destructive'
                                  : 'outline'
                              }
                            >
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{order.date || '-'}</TableCell>
                          <TableCell>
                            {bills[order.po_id] ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewBill(order.po_id)}
                                disabled={loadingBill === order.po_id}
                                className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                              >
                                {loadingBill === order.po_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <FileText className="w-4 h-4 mr-1" />
                                    <ExternalLink className="w-3 h-3" />
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">
                            No transactions found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions?.map((t) => (
                          <TableRow key={t.t_id}>
                            <TableCell className="font-mono text-xs">{t.t_id}</TableCell>
                            <TableCell>
                            <Badge
                                variant={
                                  t.type === 'adjustment'
                                    ? 'secondary'
                                    : t.type === 'return'
                                    ? 'default'
                                    : 'outline'
                                }
                              >
                                {t.type}
                              </Badge>
                            </TableCell>
                            <TableCell>{t.product?.p_name || '-'}</TableCell>
                            <TableCell>{t.amt}</TableCell>
                            <TableCell>{t.warehouse?.w_name || '-'}</TableCell>
                            <TableCell>{t.employee?.e_name || '-'}</TableCell>
                            <TableCell className="text-xs">{t.time ? new Date(t.time).toLocaleString() : '-'}</TableCell>
                            <TableCell className="max-w-xs truncate">{t.description || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
              </Card>
          </TabsContent>

          {/* Movement History Tab */}
          <TabsContent value="movement">
            <ProductMovementGraph />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
