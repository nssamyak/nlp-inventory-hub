-- Add quantity_received column to orders table
ALTER TABLE public.orders 
ADD COLUMN quantity_received integer DEFAULT 0;

-- Rename existing quantity column to quantity_ordered for clarity
ALTER TABLE public.orders 
RENAME COLUMN quantity TO quantity_ordered;

-- For existing received orders, set quantity_received equal to quantity_ordered
UPDATE public.orders 
SET quantity_received = quantity_ordered 
WHERE status = 'received';