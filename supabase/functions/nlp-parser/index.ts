import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an inventory management NLP parser. Your job is to understand natural language commands and convert them into structured actions.

Available actions and their required parameters:

1. TAKE_STOCK - Remove items from warehouse
   - product: product name or ID
   - quantity: number of items
   - warehouse: warehouse name or ID

2. RETURN_STOCK - Return items to warehouse  
   - product: product name or ID
   - quantity: number of items
   - warehouse: warehouse name or ID

3. TRANSFER_STOCK - Move items between warehouses
   - product: product name or ID
   - quantity: number of items
   - from_warehouse: source warehouse name or ID
   - to_warehouse: destination warehouse name or ID

4. CREATE_ORDER - Create a purchase order
   - product: product name or ID
   - quantity: number of items
   - supplier: supplier name or ID

5. UPDATE_ORDER_STATUS - Update order status
   - order_id: order number
   - status: one of [pending, approved, ordered, received, cancelled]

6. VIEW_PRODUCTS - Show products list
   - filter: optional filter criteria

7. VIEW_WAREHOUSES - Show warehouses list

8. VIEW_ORDERS - Show orders list
   - status: optional status filter

9. VIEW_TRANSACTIONS - Show transaction history
   - filter: optional filter criteria

10. VIEW_STOCK - Show stock levels
    - warehouse: optional warehouse filter
    - product: optional product filter

11. VIEW_SUPPLIERS - Show suppliers list

12. ADD_PRODUCT - Add new product
    - name: product name
    - price: unit price
    - manufacturer: optional
    - category: optional

13. ADD_SUPPLIER - Add new supplier
    - name: supplier name
    - address: optional
    - email: optional
    - phone: optional

14. ADD_WAREHOUSE - Add new warehouse
    - name: warehouse name
    - address: optional

Respond ONLY with a JSON object in this exact format:
{
  "action": "ACTION_NAME",
  "params": { ... relevant parameters ... },
  "message": "A brief confirmation of what you understood"
}

If the command is unclear, respond with:
{
  "action": "UNCLEAR",
  "message": "Please clarify your request. You can try commands like: 'Take 10 units of Widget A from Main Warehouse' or 'Show me all products'"
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { command, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const authHeader = req.headers.get('authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch context data for better understanding
    const [productsRes, warehousesRes, suppliersRes] = await Promise.all([
      supabase.from('products').select('pid, p_name').limit(50),
      supabase.from('warehouses').select('w_id, w_name').limit(20),
      supabase.from('suppliers').select('sup_id, s_name').limit(20),
    ]);

    const contextInfo = `
Current database context:
- Products: ${productsRes.data?.map(p => `${p.p_name} (ID: ${p.pid})`).join(', ') || 'None'}
- Warehouses: ${warehousesRes.data?.map(w => `${w.w_name} (ID: ${w.w_id})`).join(', ') || 'None'}  
- Suppliers: ${suppliersRes.data?.map(s => `${s.s_name} (ID: ${s.sup_id})`).join(', ') || 'None'}
`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + '\n\n' + contextInfo },
          { role: 'user', content: command }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a moment.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error('AI Gateway error');
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    // Parse the JSON response
    let parsed;
    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      parsed = {
        action: 'UNCLEAR',
        message: 'I had trouble understanding that. Try commands like "Take 5 units of Product X from Warehouse A"'
      };
    }

    // Execute the action
    const result = await executeAction(supabase, parsed, authHeader);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('NLP Parser error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
      action: 'ERROR',
      message: 'An error occurred processing your command.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function executeAction(supabase: any, parsed: any, authHeader: string | null) {
  const { action, params, message } = parsed;

  // Get user ID from auth header if present
  let userId = null;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id;
  }

  // Get employee ID
  let employeeId = null;
  if (userId) {
    const { data: emp } = await supabase
      .from('employees')
      .select('e_id')
      .eq('user_id', userId)
      .single();
    employeeId = emp?.e_id;
  }

  switch (action) {
    case 'VIEW_PRODUCTS': {
      const { data } = await supabase
        .from('products')
        .select('*, category:categories(cat_name)')
        .order('p_name');
      return { action, message, success: true, data, entity: 'products' };
    }

    case 'VIEW_WAREHOUSES': {
      const { data } = await supabase
        .from('warehouses')
        .select('*')
        .order('w_name');
      return { action, message, success: true, data, entity: 'warehouses' };
    }

    case 'VIEW_SUPPLIERS': {
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .order('s_name');
      return { action, message, success: true, data, entity: 'suppliers' };
    }

    case 'VIEW_ORDERS': {
      let query = supabase
        .from('orders')
        .select('*, product:products(p_name), supplier:suppliers(s_name)')
        .order('created_at', { ascending: false });
      
      if (params?.status) {
        query = query.eq('status', params.status);
      }
      
      const { data } = await query;
      return { action, message, success: true, data, entity: 'orders' };
    }

    case 'VIEW_TRANSACTIONS': {
      const { data } = await supabase
        .from('transactions')
        .select('*, product:products(p_name), warehouse:warehouses(w_name)')
        .order('time', { ascending: false })
        .limit(50);
      return { action, message, success: true, data, entity: 'transactions' };
    }

    case 'VIEW_STOCK': {
      let query = supabase
        .from('product_warehouse')
        .select('*, product:products(p_name), warehouse:warehouses(w_name)');
      
      const { data } = await query;
      return { action, message, success: true, data, entity: 'stock' };
    }

    case 'TAKE_STOCK': {
      const product = await findProduct(supabase, params.product);
      const warehouse = await findWarehouse(supabase, params.warehouse);
      
      if (!product || !warehouse) {
        return { action, success: false, message: `Could not find ${!product ? 'product' : 'warehouse'}` };
      }

      // Update stock
      const { data: currentStock } = await supabase
        .from('product_warehouse')
        .select('stock')
        .eq('pid', product.pid)
        .eq('w_id', warehouse.w_id)
        .single();

      if (!currentStock || currentStock.stock < params.quantity) {
        return { action, success: false, message: 'Insufficient stock' };
      }

      await supabase
        .from('product_warehouse')
        .update({ stock: currentStock.stock - params.quantity })
        .eq('pid', product.pid)
        .eq('w_id', warehouse.w_id);

      // Log transaction
      await supabase.from('transactions').insert({
        amt: params.quantity,
        type: 'take',
        pid: product.pid,
        w_id: warehouse.w_id,
        e_id: employeeId,
        description: `Took ${params.quantity} units of ${product.p_name} from ${warehouse.w_name}`
      });

      return { 
        action, 
        success: true, 
        message: `Successfully took ${params.quantity} units of ${product.p_name} from ${warehouse.w_name}` 
      };
    }

    case 'RETURN_STOCK': {
      const product = await findProduct(supabase, params.product);
      const warehouse = await findWarehouse(supabase, params.warehouse);
      
      if (!product || !warehouse) {
        return { action, success: false, message: `Could not find ${!product ? 'product' : 'warehouse'}` };
      }

      // Upsert stock
      const { data: currentStock } = await supabase
        .from('product_warehouse')
        .select('stock')
        .eq('pid', product.pid)
        .eq('w_id', warehouse.w_id)
        .maybeSingle();

      if (currentStock) {
        await supabase
          .from('product_warehouse')
          .update({ stock: currentStock.stock + params.quantity })
          .eq('pid', product.pid)
          .eq('w_id', warehouse.w_id);
      } else {
        await supabase
          .from('product_warehouse')
          .insert({ pid: product.pid, w_id: warehouse.w_id, stock: params.quantity });
      }

      // Log transaction
      await supabase.from('transactions').insert({
        amt: params.quantity,
        type: 'return',
        pid: product.pid,
        w_id: warehouse.w_id,
        e_id: employeeId,
        description: `Returned ${params.quantity} units of ${product.p_name} to ${warehouse.w_name}`
      });

      return { 
        action, 
        success: true, 
        message: `Successfully returned ${params.quantity} units of ${product.p_name} to ${warehouse.w_name}` 
      };
    }

    case 'CREATE_ORDER': {
      const product = await findProduct(supabase, params.product);
      const supplier = await findSupplier(supabase, params.supplier);
      
      if (!product) {
        return { action, success: false, message: 'Could not find product' };
      }

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          quantity: params.quantity,
          p_id: product.pid,
          sup_id: supplier?.sup_id,
          price: product.unit_price * params.quantity,
          created_by: employeeId,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        return { action, success: false, message: 'Failed to create order' };
      }

      return { 
        action, 
        success: true, 
        message: `Created purchase order #${order.po_id} for ${params.quantity} units of ${product.p_name}`,
        requiresBillUpload: true,
        orderId: order.po_id
      };
    }

    case 'UPDATE_ORDER_STATUS': {
      const { error } = await supabase
        .from('orders')
        .update({ status: params.status, updated_at: new Date().toISOString() })
        .eq('po_id', params.order_id);

      if (error) {
        return { action, success: false, message: 'Failed to update order' };
      }

      const requiresBill = params.status === 'received';
      
      return { 
        action, 
        success: true, 
        message: `Updated order #${params.order_id} status to ${params.status}`,
        requiresBillUpload: requiresBill,
        orderId: params.order_id
      };
    }

    case 'ADD_PRODUCT': {
      const { data, error } = await supabase
        .from('products')
        .insert({
          p_name: params.name,
          unit_price: params.price || 0,
          manufacturer: params.manufacturer,
          description: params.description
        })
        .select()
        .single();

      if (error) {
        return { action, success: false, message: 'Failed to add product' };
      }

      return { action, success: true, message: `Added product: ${params.name}`, data: [data] };
    }

    case 'ADD_SUPPLIER': {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          s_name: params.name,
          address: params.address,
          contact_email: params.email,
          contact_phone: params.phone
        })
        .select()
        .single();

      if (error) {
        return { action, success: false, message: 'Failed to add supplier' };
      }

      return { action, success: true, message: `Added supplier: ${params.name}`, data: [data] };
    }

    case 'ADD_WAREHOUSE': {
      const { data, error } = await supabase
        .from('warehouses')
        .insert({
          w_name: params.name,
          address: params.address
        })
        .select()
        .single();

      if (error) {
        return { action, success: false, message: 'Failed to add warehouse' };
      }

      return { action, success: true, message: `Added warehouse: ${params.name}`, data: [data] };
    }

    case 'TRANSFER_STOCK': {
      const product = await findProduct(supabase, params.product);
      const fromWarehouse = await findWarehouse(supabase, params.from_warehouse);
      const toWarehouse = await findWarehouse(supabase, params.to_warehouse);
      
      if (!product || !fromWarehouse || !toWarehouse) {
        return { action, success: false, message: 'Could not find product or warehouse(s)' };
      }

      // Check source stock
      const { data: sourceStock } = await supabase
        .from('product_warehouse')
        .select('stock')
        .eq('pid', product.pid)
        .eq('w_id', fromWarehouse.w_id)
        .single();

      if (!sourceStock || sourceStock.stock < params.quantity) {
        return { action, success: false, message: 'Insufficient stock at source warehouse' };
      }

      // Reduce source
      await supabase
        .from('product_warehouse')
        .update({ stock: sourceStock.stock - params.quantity })
        .eq('pid', product.pid)
        .eq('w_id', fromWarehouse.w_id);

      // Add to destination
      const { data: destStock } = await supabase
        .from('product_warehouse')
        .select('stock')
        .eq('pid', product.pid)
        .eq('w_id', toWarehouse.w_id)
        .maybeSingle();

      if (destStock) {
        await supabase
          .from('product_warehouse')
          .update({ stock: destStock.stock + params.quantity })
          .eq('pid', product.pid)
          .eq('w_id', toWarehouse.w_id);
      } else {
        await supabase
          .from('product_warehouse')
          .insert({ pid: product.pid, w_id: toWarehouse.w_id, stock: params.quantity });
      }

      // Log transaction
      await supabase.from('transactions').insert({
        amt: params.quantity,
        type: 'transfer',
        pid: product.pid,
        w_id: fromWarehouse.w_id,
        target_w_id: toWarehouse.w_id,
        e_id: employeeId,
        description: `Transferred ${params.quantity} units of ${product.p_name} from ${fromWarehouse.w_name} to ${toWarehouse.w_name}`
      });

      return { 
        action, 
        success: true, 
        message: `Transferred ${params.quantity} units of ${product.p_name} from ${fromWarehouse.w_name} to ${toWarehouse.w_name}` 
      };
    }

    default:
      return { action, success: false, message: message || 'Command not recognized' };
  }
}

async function findProduct(supabase: any, identifier: string | number) {
  if (typeof identifier === 'number') {
    const { data } = await supabase.from('products').select('*').eq('pid', identifier).single();
    return data;
  }
  
  const { data } = await supabase
    .from('products')
    .select('*')
    .ilike('p_name', `%${identifier}%`)
    .limit(1)
    .single();
  return data;
}

async function findWarehouse(supabase: any, identifier: string | number) {
  if (typeof identifier === 'number') {
    const { data } = await supabase.from('warehouses').select('*').eq('w_id', identifier).single();
    return data;
  }
  
  const { data } = await supabase
    .from('warehouses')
    .select('*')
    .ilike('w_name', `%${identifier}%`)
    .limit(1)
    .single();
  return data;
}

async function findSupplier(supabase: any, identifier: string | number) {
  if (!identifier) return null;
  
  if (typeof identifier === 'number') {
    const { data } = await supabase.from('suppliers').select('*').eq('sup_id', identifier).single();
    return data;
  }
  
  const { data } = await supabase
    .from('suppliers')
    .select('*')
    .ilike('s_name', `%${identifier}%`)
    .limit(1)
    .maybeSingle();
  return data;
}
