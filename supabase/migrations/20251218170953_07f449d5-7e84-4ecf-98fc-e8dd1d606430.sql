-- Add JSONB column for flexible invoice data (NoSQL-style document storage)
ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS invoice_data jsonb DEFAULT '{}'::jsonb;

-- Add index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_bills_invoice_data ON public.bills USING gin(invoice_data);

-- Add comment explaining the column
COMMENT ON COLUMN public.bills.invoice_data IS 'Flexible document storage for invoice details like line items, tax info, payment terms, etc.';