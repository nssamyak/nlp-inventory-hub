import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import ForceGraph2D from 'react-force-graph-2d';
import { Package, Network } from 'lucide-react';

interface Product {
  pid: number;
  p_name: string;
}

interface Warehouse {
  w_id: number;
  w_name: string;
}

interface Supplier {
  sup_id: number;
  s_name: string;
}

interface Movement {
  t_id: number;
  time: string;
  type: string;
  amt: number;
  w_id: number | null;
  target_w_id: number | null;
  description: string | null;
}

interface GraphNode {
  id: string;
  name: string;
  type: 'warehouse' | 'supplier' | 'external';
  val: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  value: number;
  label: string;
  type: string;
  curvature?: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function ProductMovementGraph() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<Movement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    fetchProducts();
    fetchWarehouses();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: 500
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchMovements(parseInt(selectedProduct));
    }
  }, [selectedProduct, warehouses, suppliers]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('pid, p_name').order('p_name');
    if (data) setProducts(data);
  };

  const fetchWarehouses = async () => {
    const { data } = await supabase.from('warehouses').select('w_id, w_name');
    if (data) setWarehouses(data);
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('sup_id, s_name');
    if (data) setSuppliers(data);
  };

  const fetchMovements = async (productId: number) => {
    setLoading(true);
    
    const { data: transactions } = await supabase
      .from('transactions')
      .select('t_id, time, type, amt, w_id, target_w_id, description')
      .eq('pid', productId)
      .order('time', { ascending: true });

    if (transactions) {
      setMovements(transactions);
      buildGraphData(transactions);
    }
    setLoading(false);
  };

  const buildGraphData = (movementData: Movement[]) => {
    const nodes: Map<string, GraphNode> = new Map();
    const linkMap: Map<string, GraphLink> = new Map();

    // Add all warehouses as nodes
    warehouses.forEach(w => {
      nodes.set(`w-${w.w_id}`, {
        id: `w-${w.w_id}`,
        name: w.w_name,
        type: 'warehouse',
        val: 10
      });
    });

    // Add external node for take/return operations
    nodes.set('external', {
      id: 'external',
      name: 'External',
      type: 'external',
      val: 8
    });

    // Process movements to create edges
    movementData.forEach(m => {
      let sourceId: string;
      let targetId: string;
      let linkType = m.type;

      if (m.type === 'transfer' && m.w_id && m.target_w_id) {
        sourceId = `w-${m.w_id}`;
        targetId = `w-${m.target_w_id}`;
      } else if (m.type === 'take' && m.w_id) {
        sourceId = `w-${m.w_id}`;
        targetId = 'external';
      } else if (m.type === 'return' && m.w_id) {
        sourceId = 'external';
        targetId = `w-${m.w_id}`;
      } else if (m.type === 'adjustment' && m.w_id) {
        sourceId = 'external';
        targetId = `w-${m.w_id}`;
        linkType = 'adjustment';
      } else {
        return;
      }

      const linkKey = `${sourceId}->${targetId}`;
      const existing = linkMap.get(linkKey);
      
      if (existing) {
        existing.value += m.amt;
        existing.label = `${existing.value} units`;
      } else {
        linkMap.set(linkKey, {
          source: sourceId,
          target: targetId,
          value: m.amt,
          label: `${m.amt} units`,
          type: linkType,
          curvature: 0.2
        });
      }
    });

    // Filter nodes to only include those with connections
    const connectedNodeIds = new Set<string>();
    linkMap.forEach(link => {
      connectedNodeIds.add(link.source);
      connectedNodeIds.add(link.target);
    });

    const filteredNodes = Array.from(nodes.values()).filter(n => connectedNodeIds.has(n.id));

    setGraphData({
      nodes: filteredNodes,
      links: Array.from(linkMap.values())
    });
  };

  const getNodeColor = (node: GraphNode) => {
    switch (node.type) {
      case 'warehouse': return 'hsl(217, 91%, 60%)';
      case 'supplier': return 'hsl(142, 76%, 36%)';
      case 'external': return 'hsl(0, 0%, 60%)';
      default: return 'hsl(0, 0%, 50%)';
    }
  };

  const getLinkColor = (link: GraphLink) => {
    switch (link.type) {
      case 'transfer': return 'hsl(217, 91%, 60%)';
      case 'take': return 'hsl(0, 84%, 60%)';
      case 'return': return 'hsl(142, 76%, 36%)';
      case 'adjustment': return 'hsl(38, 92%, 50%)';
      default: return 'hsl(0, 0%, 50%)';
    }
  };

  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.6);

    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, node.val / 2, 0, 2 * Math.PI, false);
    ctx.fillStyle = getNodeColor(node);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = 'hsl(0, 0%, 100%)';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();

    // Draw label background
    ctx.fillStyle = 'hsla(0, 0%, 0%, 0.7)';
    ctx.fillRect(
      node.x! - bckgDimensions[0] / 2,
      node.y! + node.val / 2 + 2,
      bckgDimensions[0],
      bckgDimensions[1]
    );

    // Draw label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'hsl(0, 0%, 100%)';
    ctx.fillText(label, node.x!, node.y! + node.val / 2 + 4);
  }, []);

  const linkCanvasObject = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source as unknown as { x: number; y: number };
    const end = link.target as unknown as { x: number; y: number };
    
    if (!start.x || !end.x) return;

    // Draw link label at midpoint
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    const fontSize = 10 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = getLinkColor(link);
    ctx.fillText(link.label, midX, midY - 8 / globalScale);
  }, []);

  const selectedProductName = products.find(p => p.pid.toString() === selectedProduct)?.p_name;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="w-5 h-5" />
            Product Movement Network
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <label className="text-sm text-muted-foreground mb-2 block">Select a product to view movement network</label>
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

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'hsl(217, 91%, 60%)' }} />
              <span>Warehouse</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'hsl(0, 0%, 60%)' }} />
              <span>External</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: 'hsl(217, 91%, 60%)' }} />
              <span>Transfer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }} />
              <span>Take</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }} />
              <span>Return</span>
            </div>
          </div>

          {loading && (
            <div className="h-[500px] flex items-center justify-center text-muted-foreground">
              Loading movement data...
            </div>
          )}

          {!loading && selectedProduct && movements.length === 0 && (
            <div className="h-[500px] flex items-center justify-center text-muted-foreground">
              No movement history found for this product.
            </div>
          )}

          {!loading && selectedProduct && movements.length > 0 && (
            <div ref={containerRef} className="border rounded-lg bg-muted/20 overflow-hidden">
              <ForceGraph2D
                graphData={graphData}
                width={dimensions.width}
                height={dimensions.height}
                nodeCanvasObject={nodeCanvasObject}
                linkColor={(link) => getLinkColor(link as GraphLink)}
                linkWidth={(link) => Math.min(Math.max((link as GraphLink).value / 10, 1), 5)}
                linkDirectionalArrowLength={6}
                linkDirectionalArrowRelPos={0.9}
                linkCurvature={0.2}
                linkCanvasObjectMode={() => 'after'}
                linkCanvasObject={linkCanvasObject}
                cooldownTicks={100}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
              />
            </div>
          )}

          {!selectedProduct && (
            <div className="h-[500px] flex items-center justify-center text-muted-foreground">
              Select a product to view its movement network across warehouses.
            </div>
          )}

          {/* Movement summary */}
          {selectedProduct && movements.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Movement Summary for {selectedProductName}</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {movements.filter(m => m.type === 'transfer').length} transfers
                </Badge>
                <Badge variant="outline">
                  {movements.filter(m => m.type === 'take').length} takes
                </Badge>
                <Badge variant="outline">
                  {movements.filter(m => m.type === 'return').length} returns
                </Badge>
                <Badge variant="outline">
                  {movements.reduce((acc, m) => acc + m.amt, 0)} total units moved
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
