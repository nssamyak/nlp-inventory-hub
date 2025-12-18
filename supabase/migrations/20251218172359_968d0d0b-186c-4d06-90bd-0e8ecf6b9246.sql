-- Add target warehouse to orders
ALTER TABLE public.orders 
ADD COLUMN target_w_id integer REFERENCES public.warehouses(w_id);

-- Add index for performance
CREATE INDEX idx_orders_target_w_id ON public.orders(target_w_id);