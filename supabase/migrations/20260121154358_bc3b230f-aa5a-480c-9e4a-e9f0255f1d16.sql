
-- Make user_id nullable to allow dummy employees for demo/testing
ALTER TABLE public.employees ALTER COLUMN user_id DROP NOT NULL;

-- Add dummy employees for different roles across departments
INSERT INTO public.employees (f_name, l_name, e_name, d_id, role_id)
VALUES 
  ('Diana', 'Prince', 'Diana Prince', 3, 2),      -- Manager, Management dept
  ('Clark', 'Kent', 'Clark Kent', 1, 3),          -- Warehouse Staff, Operations
  ('Barry', 'Allen', 'Barry Allen', 1, 3),        -- Warehouse Staff, Operations
  ('Arthur', 'Curry', 'Arthur Curry', 2, 4),      -- Procurement Officer
  ('Victor', 'Stone', 'Victor Stone', 1, 3),      -- Warehouse Staff, Operations
  ('Hal', 'Jordan', 'Hal Jordan', 2, 4),          -- Procurement Officer
  ('Selina', 'Kyle', 'Selina Kyle', 3, 2),        -- Manager
  ('Oliver', 'Queen', 'Oliver Queen', 1, 3);      -- Warehouse Staff

-- Update warehouses to have managers
UPDATE public.warehouses
SET mgr_id = (SELECT e_id FROM public.employees WHERE e_name = 'Diana Prince' LIMIT 1)
WHERE w_name = 'East Coast Fulfillment';

UPDATE public.warehouses
SET mgr_id = (SELECT e_id FROM public.employees WHERE e_name = 'Selina Kyle' LIMIT 1)
WHERE w_name = 'West Coast Logistics';

UPDATE public.warehouses
SET mgr_id = (SELECT e_id FROM public.employees WHERE e_name = 'Oliver Queen' LIMIT 1)
WHERE w_name = 'Southeast Regional';

-- Update existing transactions to distribute among employees
UPDATE public.transactions 
SET e_id = (SELECT e_id FROM public.employees WHERE e_name = 'Clark Kent' LIMIT 1)
WHERE t_id IN (1, 4, 7);

UPDATE public.transactions 
SET e_id = (SELECT e_id FROM public.employees WHERE e_name = 'Barry Allen' LIMIT 1)
WHERE t_id IN (2, 5, 8);

UPDATE public.transactions 
SET e_id = (SELECT e_id FROM public.employees WHERE e_name = 'Victor Stone' LIMIT 1)
WHERE t_id IN (3, 6, 9);
