import { useMemo, useState, useEffect } from 'react';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DataTableProps {
  data: unknown[];
}

interface BillInfo {
  bill_id: string;
  file_url: string;
  order_id: number;
}

export function DataTable({ data }: DataTableProps) {
  const [bills, setBills] = useState<Record<number, BillInfo>>({});
  const [loadingBill, setLoadingBill] = useState<number | null>(null);
  const { toast } = useToast();

  // Check if this is order data (has po_id field)
  const isOrderData = useMemo(() => {
    if (!data || data.length === 0) return false;
    const first = data[0] as Record<string, unknown>;
    return 'po_id' in first || 'orderId' in first || 'order_id' in first;
  }, [data]);

  // Fetch bills for orders
  useEffect(() => {
    if (!isOrderData || !data || data.length === 0) return;

    const fetchBills = async () => {
      const orderIds = data.map(row => {
        const r = row as Record<string, unknown>;
        return (r.po_id || r.orderId || r.order_id) as number;
      }).filter(Boolean);

      if (orderIds.length === 0) return;

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
  }, [data, isOrderData]);

  const handleViewBill = async (orderId: number) => {
    const bill = bills[orderId];
    if (!bill) return;

    setLoadingBill(orderId);
    try {
      // Generate signed URL for private bucket
      const { data: signedUrl, error } = await supabase.storage
        .from('bills')
        .createSignedUrl(bill.file_url, 3600); // 1 hour expiry

      if (error) throw error;

      // Open in new tab
      window.open(signedUrl.signedUrl, '_blank');
    } catch (error) {
      console.error('Error getting bill URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to retrieve bill. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingBill(null);
    }
  };

  if (!data || data.length === 0) return null;

  const columns = useMemo(() => {
    const first = data[0] as Record<string, unknown>;
    return Object.keys(first).filter(key => 
      !key.includes('_id') && 
      key !== 'id' && 
      key !== 'created_at' && 
      key !== 'updated_at' &&
      typeof first[key] !== 'object'
    ).slice(0, 6);
  }, [data]);

  const formatValue = (value: unknown, key: string): React.ReactNode => {
    if (value === null || value === undefined) return '-';
    
    if (key === 'status') {
      const status = value as string;
      const statusColors: Record<string, string> = {
        pending: 'status-pending',
        approved: 'status-approved',
        ordered: 'bg-primary/20 text-primary',
        received: 'status-received',
        cancelled: 'status-cancelled',
      };
      return <Badge className={`status-badge ${statusColors[status] || ''}`}>{status}</Badge>;
    }

    if (key === 'type') {
      const type = value as string;
      const typeColors: Record<string, string> = {
        take: 'bg-destructive/20 text-destructive',
        return: 'bg-success/20 text-success',
        transfer: 'bg-primary/20 text-primary',
        adjustment: 'bg-warning/20 text-warning',
      };
      return <Badge className={`status-badge ${typeColors[type] || ''}`}>{type}</Badge>;
    }

    if (typeof value === 'number') {
      if (key.includes('price') || key.includes('Price')) {
        return `$${value.toFixed(2)}`;
      }
      return value.toLocaleString();
    }

    if (key === 'time' || key.includes('date') || key.includes('Date')) {
      return new Date(value as string).toLocaleDateString();
    }

    return String(value);
  };

  const formatHeader = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .trim();
  };

  const getOrderId = (row: Record<string, unknown>): number | null => {
    return (row.po_id || row.orderId || row.order_id) as number | null;
  };

  return (
    <div className="rounded-md border border-border/50 overflow-hidden bg-card/50 backdrop-blur">
      <Table className="data-table">
        <TableHeader>
          <TableRow className="border-border/50 hover:bg-transparent">
            {columns.map(col => (
              <TableHead key={col} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {formatHeader(col)}
              </TableHead>
            ))}
            {isOrderData && (
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Invoice
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.slice(0, 10).map((row, i) => {
            const orderId = isOrderData ? getOrderId(row as Record<string, unknown>) : null;
            const hasBill = orderId ? !!bills[orderId] : false;

            return (
              <TableRow key={i} className="border-border/30 hover:bg-muted/30">
                {columns.map(col => (
                  <TableCell key={col} className="text-sm">
                    {formatValue((row as Record<string, unknown>)[col], col)}
                  </TableCell>
                ))}
                {isOrderData && (
                  <TableCell className="text-sm">
                    {hasBill && orderId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewBill(orderId)}
                        disabled={loadingBill === orderId}
                        className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                      >
                        {loadingBill === orderId ? (
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
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {data.length > 10 && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border/30 bg-muted/20">
          Showing 10 of {data.length} results
        </div>
      )}
    </div>
  );
}
