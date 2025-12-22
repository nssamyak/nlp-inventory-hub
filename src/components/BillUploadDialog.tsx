import { useState } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface BillUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number | null;
  onComplete: () => void;
}

export function BillUploadDialog({ open, onOpenChange, orderId, onComplete }: BillUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { employee } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 10MB',
          variant: 'destructive',
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !orderId) return;

    setUploading(true);
    try {
      // Get order details for supplier
      const { data: order } = await supabase
        .from('orders')
        .select('sup_id')
        .eq('po_id', orderId)
        .single();

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `order_${orderId}_${Date.now()}.${fileExt}`;
      const filePath = `${orderId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('bills')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL (or signed URL for private bucket)
      const { data: urlData } = supabase.storage
        .from('bills')
        .getPublicUrl(filePath);

      // Store metadata in bills table
      const { error: billError } = await supabase
        .from('bills')
        .insert({
          order_id: orderId,
          supplier_id: order?.sup_id,
          file_url: filePath, // Store path for signed URL generation
          file_type: file.type,
          uploaded_by: employee?.e_id,
          notes: notes || null,
        });

      if (billError) throw billError;

      toast({
        title: 'Success',
        description: 'Bill uploaded successfully',
      });

      onComplete();
      handleClose();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload bill. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {/* Prevent closing without upload */}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Bill/Invoice (Required)</DialogTitle>
          <DialogDescription>
            You must upload the bill or invoice for order #{orderId} before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              file ? 'border-success bg-success/5' : 'border-border hover:border-primary/50'
            }`}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-success" />
                <div className="text-left">
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  onClick={() => setFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, PNG, JPG up to 10MB
                </p>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this bill..."
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Upload Bill'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
