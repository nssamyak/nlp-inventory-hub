import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ArrowRight, Package, TrendingUp } from 'lucide-react';

interface Product {
  pid: number;
  p_name: string;
}

interface Warehouse {
  w_id: number;
  w_name: string;
}

interface Movement {
  t_id: number;
  time: string;
  type: string;
  amt: number;
  w_id: number | null;
  target_w_id: number | null;
  description: string | null;
  warehouse_name: string | null;
  target_warehouse_name: string | null;
}

interface ChartDataPoint {
  date: string;
  [key: string]: number | string;
}

export function ProductMovementGraph() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [movements, setMovements] = useState<Movement[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchMovements(parseInt(selectedProduct));
    }
  }, [selectedProduct]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('pid, p_name').order('p_name');
    if (data) setProducts(data);
  };

  const fetchWarehouses = async () => {
    const { data } = await supabase.from('warehouses').select('w_id, w_name');
    if (data) setWarehouses(data);
  };

  const fetchMovements = async (productId: number) => {
    setLoading(true);
    
    // Fetch all transactions for this product
    const { data: transactions } = await supabase
      .from('transactions')
      .select('t_id, time, type, amt, w_id, target_w_id, description')
      .eq('pid', productId)
      .order('time', { ascending: true });

    if (transactions) {
      // Enrich with warehouse names
      const enrichedMovements: Movement[] = await Promise.all(
        transactions.map(async (t) => {
          let warehouse_name = null;
          let target_warehouse_name = null;

          if (t.w_id) {
            const wh = warehouses.find(w => w.w_id === t.w_id);
            warehouse_name = wh?.w_name || null;
          }
          if (t.target_w_id) {
            const twh = warehouses.find(w => w.w_id === t.target_w_id);
            target_warehouse_name = twh?.w_name || null;
          }

          return {
            ...t,
            warehouse_name,
            target_warehouse_name,
          };
        })
      );

      setMovements(enrichedMovements);
      generateChartData(enrichedMovements);
    }
    setLoading(false);
  };

  const generateChartData = (movementData: Movement[]) => {
    // Group movements by date and warehouse
    const warehouseStocks: Record<string, Record<string, number>> = {};
    const uniqueWarehouses = new Set<string>();

    movementData.forEach((m) => {
      const date = new Date(m.time).toLocaleDateString();
      
      if (!warehouseStocks[date]) {
        // Copy previous day's data
        const dates = Object.keys(warehouseStocks);
        if (dates.length > 0) {
          warehouseStocks[date] = { ...warehouseStocks[dates[dates.length - 1]] };
        } else {
          warehouseStocks[date] = {};
        }
      }

      const whName = m.warehouse_name || `Warehouse ${m.w_id}`;
      const targetWhName = m.target_warehouse_name || (m.target_w_id ? `Warehouse ${m.target_w_id}` : null);

      uniqueWarehouses.add(whName);
      if (targetWhName) uniqueWarehouses.add(targetWhName);

      // Initialize warehouse if not exists
      if (warehouseStocks[date][whName] === undefined) {
        warehouseStocks[date][whName] = 0;
      }

      // Apply movement
      if (m.type === 'take') {
        warehouseStocks[date][whName] = Math.max(0, (warehouseStocks[date][whName] || 0) - m.amt);
      } else if (m.type === 'return') {
        warehouseStocks[date][whName] = (warehouseStocks[date][whName] || 0) + m.amt;
      } else if (m.type === 'transfer' && targetWhName) {
        warehouseStocks[date][whName] = Math.max(0, (warehouseStocks[date][whName] || 0) - m.amt);
        if (warehouseStocks[date][targetWhName] === undefined) {
          warehouseStocks[date][targetWhName] = 0;
        }
        warehouseStocks[date][targetWhName] = (warehouseStocks[date][targetWhName] || 0) + m.amt;
      } else if (m.type === 'adjustment') {
        warehouseStocks[date][whName] = (warehouseStocks[date][whName] || 0) + m.amt;
      }
    });

    // Convert to chart data
    const chartDataPoints: ChartDataPoint[] = Object.entries(warehouseStocks).map(([date, stocks]) => ({
      date,
      ...stocks,
    }));

    setChartData(chartDataPoints);
  };

  const getWarehouseColors = () => {
    const colors = ['hsl(var(--primary))', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(280, 87%, 65%)', 'hsl(199, 89%, 48%)'];
    const warehouseNames = [...new Set(movements.flatMap(m => [m.warehouse_name, m.target_warehouse_name].filter(Boolean)))];
    return warehouseNames.reduce((acc, name, idx) => {
      if (name) acc[name] = colors[idx % colors.length];
      return acc;
    }, {} as Record<string, string>);
  };

  const warehouseColors = getWarehouseColors();
  const selectedProductName = products.find(p => p.pid.toString() === selectedProduct)?.p_name;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Product Movement History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <label className="text-sm text-muted-foreground mb-2 block">Select a product to view movement history</label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Choose a product..." />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.pid} value={p.pid.toString()}>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      {p.p_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Loading movement data...
            </div>
          )}

          {!loading && selectedProduct && movements.length === 0 && (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No movement history found for this product.
            </div>
          )}

          {!loading && selectedProduct && movements.length > 0 && (
            <>
              <div className="h-80 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    {Object.keys(warehouseColors).map((whName) => (
                      <Line
                        key={whName}
                        type="monotone"
                        dataKey={whName}
                        stroke={warehouseColors[whName]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Movement Timeline for {selectedProductName}</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {movements.map((m) => (
                    <div key={m.t_id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                      <Badge variant={
                        m.type === 'transfer' ? 'default' : 
                        m.type === 'take' ? 'destructive' : 
                        m.type === 'return' ? 'secondary' : 'outline'
                      }>
                        {m.type}
                      </Badge>
                      <span className="font-mono">{m.amt} units</span>
                      {m.type === 'transfer' && (
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground">{m.warehouse_name || 'Unknown'}</span>
                          <ArrowRight className="w-4 h-4 text-primary" />
                          <span className="text-muted-foreground">{m.target_warehouse_name || 'Unknown'}</span>
                        </span>
                      )}
                      {m.type !== 'transfer' && (
                        <span className="text-muted-foreground">
                          {m.type === 'take' ? 'from' : 'to'} {m.warehouse_name || 'Unknown'}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(m.time).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!selectedProduct && (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Select a product to view its movement history across warehouses.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
