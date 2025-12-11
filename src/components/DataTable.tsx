import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface DataTableProps {
  data: unknown[];
}

export function DataTable({ data }: DataTableProps) {
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.slice(0, 10).map((row, i) => (
            <TableRow key={i} className="border-border/30 hover:bg-muted/30">
              {columns.map(col => (
                <TableCell key={col} className="text-sm">
                  {formatValue((row as Record<string, unknown>)[col], col)}
                </TableCell>
              ))}
            </TableRow>
          ))}
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
