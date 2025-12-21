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

3. TRANSFER_STOCK - Move items between warehouses (use when source is explicitly specified)
   - product: product name or ID
   - quantity: number of items
   - from_warehouse: source warehouse name or ID
   - to_warehouse: destination warehouse name or ID

4. MOVE_PRODUCT - Move product to a warehouse (use when source is NOT specified)
   - product: product name or ID
   - quantity: number of items
   - to_warehouse: destination warehouse name or ID
   - from_warehouse: optional source warehouse (if not specified, system will find where product exists)

5. CREATE_ORDER - Create a purchase order
   - product: product name or ID (REQUIRED)
   - quantity: number of items (REQUIRED)
   - warehouse: destination warehouse name or ID (REQUIRED - where ordering TO)
   - supplier: supplier name or ID (OPTIONAL - where ordering FROM, will ask if not provided)
   - unit_price: price per unit (OPTIONAL - e.g., "$549.99", "549.99")

6. RECEIVE_ORDER - Mark order(s) as received with flexible matching
   - product: product name (optional - for matching by product)
   - quantity: quantity received (optional - for partial receives or validation)
   - warehouse: warehouse name where received (optional - for matching)
   - order_id: specific order ID (optional - if user specifies order number)
   - Use this for commands like "I received X", "received 5 widgets in Main Warehouse", "I got the bolts", "order arrived"

7. UPDATE_ORDER_STATUS - Update order status (for non-receive status changes)
   - order_id: order ID (optional if product specified)
   - product: product name (optional - for matching orders by product)
   - status: one of [pending, approved, ordered, shipped, cancelled, reordered]
   - Use this for: "cancel order #123", "cancel the widget order", "approve order 5", "reorder #10", "reorder the bolts", "mark order 7 as shipped"

8. VIEW_PRODUCTS - Show all products list (general view without warehouse filter)
   - filter: optional filter criteria

9. VIEW_PRODUCTS_IN_WAREHOUSE - Show products with stock levels in a specific warehouse
   - warehouse: warehouse name or ID (required)

10. VIEW_WAREHOUSES - Show warehouses list

11. VIEW_ORDERS - Show orders list
    - status: optional status filter

12. VIEW_TRANSACTIONS - Show transaction history
    - filter: optional filter criteria

13. VIEW_STOCK - Show stock levels across all warehouses
    - warehouse: optional warehouse filter
    - product: optional product filter

14. VIEW_SUPPLIERS - Show suppliers list

15. ADD_PRODUCT - Add new product
    - name: product name
    - price: unit price
    - manufacturer: optional
    - category: optional

16. ADD_SUPPLIER - Add new supplier
    - name: supplier name
    - address: optional
    - email: optional
    - phone: optional

17. ADD_WAREHOUSE - Add new warehouse
    - name: warehouse name
    - address: optional

IMPORTANT RULES FOR RECEIVING ORDERS:
- "I received X" or "received X" or "got X" or "X arrived" → RECEIVE_ORDER with product: X
- "I received 5 X" or "received 5 pieces of X" or "got 5 Xs" → RECEIVE_ORDER with product: X, quantity: 5
- "I received X in Y warehouse" → RECEIVE_ORDER with product: X, warehouse: Y
- "Update order #123 to received" or "mark order 123 received" → RECEIVE_ORDER with order_id: 123
- "order arrived" or "the order is here" → RECEIVE_ORDER (system will find pending orders)

IMPORTANT RULES FOR OTHER STATUS UPDATES:
- "Cancel order #123" → UPDATE_ORDER_STATUS with order_id: 123, status: cancelled
- "Cancel the widget order" → UPDATE_ORDER_STATUS with product: widget, status: cancelled
- "Approve order #5" → UPDATE_ORDER_STATUS with order_id: 5, status: approved  
- "Reorder #10" or "reorder the bolts" → UPDATE_ORDER_STATUS with status: reordered
- "Mark order as shipped" → UPDATE_ORDER_STATUS with status: shipped

OTHER IMPORTANT RULES:
- When user says "show products in [warehouse]", "what's in [warehouse]", "products at [warehouse]" → use VIEW_PRODUCTS_IN_WAREHOUSE
- When user says "show products", "list products", "view products" without warehouse → use VIEW_PRODUCTS
- When user says "moved X to Y" or "move X to Y" WITHOUT specifying source → use MOVE_PRODUCT (system will find source)
- When user says "moved X from A to B" or "transfer X from A to B" → use TRANSFER_STOCK

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
    const [productsRes, warehousesRes, suppliersRes, stockRes, ordersRes] = await Promise.all([
      supabase.from('products').select('pid, p_name').limit(50),
      supabase.from('warehouses').select('w_id, w_name').limit(20),
      supabase.from('suppliers').select('sup_id, s_name').limit(20),
      supabase.from('product_warehouse').select('pid, w_id, stock, product:products(p_name), warehouse:warehouses(w_name)').limit(100),
      supabase.from('orders').select('po_id, status, quantity, product:products(p_name), supplier:suppliers(s_name), warehouse:warehouses(w_name)').in('status', ['pending', 'approved', 'ordered', 'shipped']).limit(20),
    ]);

    const contextInfo = `
Current database context:
- Products: ${productsRes.data?.map(p => `${p.p_name} (ID: ${p.pid})`).join(', ') || 'None'}
- Warehouses: ${warehousesRes.data?.map(w => `${w.w_name} (ID: ${w.w_id})`).join(', ') || 'None'}  
- Suppliers: ${suppliersRes.data?.map(s => `${s.s_name} (ID: ${s.sup_id})`).join(', ') || 'None'}
- Current Stock Distribution: ${stockRes.data?.map(s => `${(s.product as any)?.p_name} has ${s.stock} units in ${(s.warehouse as any)?.w_name}`).join('; ') || 'None'}
- Pending/Active Orders: ${ordersRes.data?.map(o => `Order #${o.po_id}: ${o.quantity}x ${(o.product as any)?.p_name} from ${(o.supplier as any)?.s_name} (${o.status})`).join('; ') || 'None'}
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

    case 'VIEW_PRODUCTS_IN_WAREHOUSE': {
      const warehouse = await findWarehouse(supabase, params.warehouse);
      
      if (!warehouse) {
        return { action, success: false, message: `Could not find warehouse: ${params.warehouse}` };
      }

      const { data, error } = await supabase
        .from('product_warehouse')
        .select(`
          stock,
          product:products(pid, p_name, description, manufacturer, unit_price, quantity, category:categories(cat_name)),
          warehouse:warehouses(w_id, w_name)
        `)
        .eq('w_id', warehouse.w_id)
        .gt('stock', 0);

      if (error) {
        console.error('Error fetching products in warehouse:', error);
        return { action, success: false, message: 'Failed to fetch products' };
      }

      const transformedData = data?.map((item: any) => ({
        product_id: item.product?.pid,
        product_name: item.product?.p_name,
        description: item.product?.description,
        manufacturer: item.product?.manufacturer,
        unit_price: item.product?.unit_price,
        stock_in_warehouse: item.stock,
        category: item.product?.category?.cat_name,
        warehouse: item.warehouse?.w_name
      })) || [];

      return { 
        action, 
        message: `Products in ${warehouse.w_name}`, 
        success: true, 
        data: transformedData, 
        entity: 'products_in_warehouse' 
      };
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
        .select('*, product:products(p_name), supplier:suppliers(s_name), target_warehouse:warehouses(w_name)')
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
      
      if (params?.warehouse) {
        const warehouse = await findWarehouse(supabase, params.warehouse);
        if (warehouse) {
          query = query.eq('w_id', warehouse.w_id);
        }
      }
      
      if (params?.product) {
        const product = await findProduct(supabase, params.product);
        if (product) {
          query = query.eq('pid', product.pid);
        }
      }
      
      const { data } = await query;
      return { action, message, success: true, data, entity: 'stock' };
    }

    case 'TAKE_STOCK': {
      const product = await findProduct(supabase, params.product);
      const warehouse = await findWarehouse(supabase, params.warehouse);
      
      if (!product || !warehouse) {
        return { action, success: false, message: `Could not find ${!product ? 'product' : 'warehouse'}` };
      }

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
      if (!params.warehouse) {
        return { action, success: false, message: 'Please specify the target warehouse (where the order should go TO). Example: "Order 10 widgets to Main Warehouse" or "I ordered 5 CPUs at $500 to East"' };
      }

      const warehouse = await findWarehouse(supabase, params.warehouse);
      if (!warehouse) {
        return { action, success: false, message: `Could not find warehouse: ${params.warehouse}. Please add the warehouse first or check the name.` };
      }

      // Supplier is optional - if not provided, we'll create the order without one
      let supplier = null;
      if (params.supplier) {
        supplier = await findSupplier(supabase, params.supplier);
        if (!supplier) {
          return { action, success: false, message: `Could not find supplier: ${params.supplier}. Please add the supplier first or check the name.` };
        }
      }

      let product = await findProductExact(supabase, params.product);
      
      // Parse unit price if provided (handles "$549.99", "549.99", etc.)
      let unitPrice = null;
      if (params.unit_price) {
        const priceStr = String(params.unit_price).replace(/[$,]/g, '');
        unitPrice = parseFloat(priceStr);
        if (isNaN(unitPrice)) unitPrice = null;
      }
      
      if (!product) {
        const similarProducts = await findSimilarProducts(supabase, params.product);
        
        if (similarProducts && similarProducts.length > 0) {
          const productList = similarProducts.map((p: any) => `"${p.p_name}" (ID: ${p.pid})`).join(', ');
          return { 
            action, 
            success: false, 
            message: `Product "${params.product}" not found. Did you mean one of these? ${productList}. Please reorder using the exact product name, or say "Add product ${params.product}" to create a new one.`,
            suggestedProducts: similarProducts
          };
        } else {
          // Auto-create the product if we have a price
          if (unitPrice !== null) {
            const { data: newProduct, error: productError } = await supabase
              .from('products')
              .insert({
                p_name: params.product,
                unit_price: unitPrice,
                quantity: 0
              })
              .select()
              .single();
            
            if (productError) {
              console.error('Product creation error:', productError);
              return { action, success: false, message: 'Failed to create product' };
            }
            
            product = newProduct;
          } else {
            return { 
              action, 
              success: false, 
              message: `Product "${params.product}" does not exist. Would you like to add it? Try: "Add product ${params.product} at price X" then reorder, or include the price: "Order 5 ${params.product} at $100 to ${params.warehouse}"`
            };
          }
        }
      }

      // Use provided unit price or fall back to product's unit price
      const finalUnitPrice = unitPrice !== null ? unitPrice : (product.unit_price || 0);
      const totalPrice = finalUnitPrice * params.quantity;

      // If unit price was provided but product didn't have one, update the product
      if (unitPrice !== null && product.unit_price !== unitPrice) {
        await supabase
          .from('products')
          .update({ unit_price: unitPrice })
          .eq('pid', product.pid);
      }

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          quantity: params.quantity,
          p_id: product.pid,
          sup_id: supplier?.sup_id || null,
          target_w_id: warehouse.w_id,
          price: totalPrice,
          created_by: employeeId,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Order creation error:', error);
        return { action, success: false, message: 'Failed to create order' };
      }

      const supplierInfo = supplier ? ` from ${supplier.s_name}` : '';
      const priceInfo = totalPrice > 0 ? ` (Total: $${totalPrice.toFixed(2)})` : '';
      
      return { 
        action, 
        success: true, 
        message: `Created purchase order #${order.po_id} for ${params.quantity}x ${product.p_name}${supplierInfo} → ${warehouse.w_name}${priceInfo}. Product quantity will update when order is marked as received.`,
        requiresBillUpload: true,
        orderId: order.po_id
      };
    }

    case 'RECEIVE_ORDER': {
      // Smart order matching - find the order based on provided params
      let matchingOrders: any[] = [];
      
      // If specific order_id provided, use that
      if (params.order_id) {
        const { data: order } = await supabase
          .from('orders')
          .select('*, product:products(pid, p_name), supplier:suppliers(s_name), target_warehouse:warehouses(w_id, w_name)')
          .eq('po_id', params.order_id)
          .in('status', ['pending', 'approved', 'ordered', 'shipped', 'partial'])
          .single();
        
        if (order) {
          matchingOrders = [order];
        }
      } else {
        // Build query based on available params
        let query = supabase
          .from('orders')
          .select('*, product:products(pid, p_name), supplier:suppliers(s_name), target_warehouse:warehouses(w_id, w_name)')
          .in('status', ['pending', 'approved', 'ordered', 'shipped', 'partial']);

        const { data: orders } = await query;
        
        if (orders && orders.length > 0) {
          // Filter by product if specified
          if (params.product) {
            const productSearch = params.product.toLowerCase();
            matchingOrders = orders.filter((o: any) => {
              const productName = (o.product as any)?.p_name?.toLowerCase() || '';
              return productName.includes(productSearch) || productSearch.includes(productName.split(' ')[0]);
            });
          }
          
          // Filter by warehouse if specified
          if (params.warehouse && matchingOrders.length > 0) {
            const warehouse = await findWarehouse(supabase, params.warehouse);
            if (warehouse) {
              matchingOrders = matchingOrders.filter((o: any) => o.target_w_id === warehouse.w_id);
            }
          }
          
          // Filter by quantity if specified (for exact match)
          if (params.quantity && matchingOrders.length > 0) {
            const exactQuantityMatches = matchingOrders.filter((o: any) => o.quantity === params.quantity);
            if (exactQuantityMatches.length > 0) {
              matchingOrders = exactQuantityMatches;
            }
          }
          
          // If no filters matched but we have orders, use all pending orders
          if (matchingOrders.length === 0 && !params.product && !params.warehouse) {
            matchingOrders = orders;
          }
        }
      }

      // Handle results
      if (matchingOrders.length === 0) {
        return { 
          action, 
          success: false, 
          message: `No pending orders found${params.product ? ` for "${params.product}"` : ''}${params.warehouse ? ` to ${params.warehouse}` : ''}. Use "show orders" to see all orders.`
        };
      }

      if (matchingOrders.length > 1) {
        // Ask for clarification
        const orderList = matchingOrders.slice(0, 5).map((o: any) => 
          `Order #${o.po_id}: ${o.quantity}x ${(o.product as any)?.p_name} from ${(o.supplier as any)?.s_name} → ${(o.target_warehouse as any)?.w_name} (${o.status})`
        ).join('\n');
        
        return { 
          action, 
          success: false, 
          message: `Multiple orders found. Please specify which one:\n${orderList}\n\nTry: "Received order #<ID>" or add more details like warehouse name.`,
          pendingOrders: matchingOrders.slice(0, 5).map((o: any) => ({
            po_id: o.po_id,
            quantity: o.quantity,
            product: (o.product as any)?.p_name,
            supplier: (o.supplier as any)?.s_name,
            warehouse: (o.target_warehouse as any)?.w_name,
            status: o.status
          }))
        };
      }

      // Single order found - process it
      const order = matchingOrders[0];
      const targetWarehouseId = order.target_w_id;
      const productId = order.p_id;
      
      // Determine quantity to receive (partial or full)
      const orderQuantity = order.quantity;
      const receivedQuantity = params.quantity || orderQuantity; // Default to full order if not specified
      
      // Validate received quantity
      if (receivedQuantity > orderQuantity) {
        return { 
          action, 
          success: false, 
          message: `Cannot receive ${receivedQuantity} units. Order #${order.po_id} only has ${orderQuantity} units remaining.`
        };
      }
      
      // Calculate remaining quantity
      const remainingQuantity = orderQuantity - receivedQuantity;
      const isPartialReceive = remainingQuantity > 0;
      
      // Update order status and remaining quantity
      const newStatus = isPartialReceive ? 'partial' : 'received';
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: newStatus, 
          quantity: remainingQuantity,
          updated_at: new Date().toISOString() 
        })
        .eq('po_id', order.po_id);

      if (updateError) {
        return { action, success: false, message: 'Failed to update order status' };
      }

      // Add stock to target warehouse
      const { data: existingStock } = await supabase
        .from('product_warehouse')
        .select('stock')
        .eq('pid', productId)
        .eq('w_id', targetWarehouseId)
        .maybeSingle();

      if (existingStock) {
        await supabase
          .from('product_warehouse')
          .update({ stock: existingStock.stock + receivedQuantity })
          .eq('pid', productId)
          .eq('w_id', targetWarehouseId);
      } else {
        await supabase
          .from('product_warehouse')
          .insert({ pid: productId, w_id: targetWarehouseId, stock: receivedQuantity });
      }

      // Update total product quantity
      const { data: currentProduct } = await supabase
        .from('products')
        .select('quantity')
        .eq('pid', productId)
        .single();

      await supabase
        .from('products')
        .update({ quantity: (currentProduct?.quantity || 0) + receivedQuantity })
        .eq('pid', productId);

      // Log transaction
      await supabase.from('transactions').insert({
        amt: receivedQuantity,
        type: 'receive',
        pid: productId,
        w_id: targetWarehouseId,
        e_id: employeeId,
        description: `Received ${receivedQuantity} units of ${(order.product as any)?.p_name} from order #${order.po_id}${isPartialReceive ? ` (partial, ${remainingQuantity} remaining)` : ''}`
      });

      const message = isPartialReceive 
        ? `Partially received ${receivedQuantity} of ${orderQuantity} units of ${(order.product as any)?.p_name} to ${(order.target_warehouse as any)?.w_name}. Order #${order.po_id} has ${remainingQuantity} units remaining.`
        : `Order #${order.po_id} fully received. Added ${receivedQuantity} units of ${(order.product as any)?.p_name} to ${(order.target_warehouse as any)?.w_name}.`;

      return { 
        action, 
        success: true, 
        message,
        requiresBillUpload: false, // Bill is now only required when creating orders
        orderId: order.po_id
      };
    }

    case 'UPDATE_ORDER_STATUS': {
      // Find order by ID or product
      let order: any = null;
      
      if (params.order_id) {
        const { data } = await supabase
          .from('orders')
          .select('*, product:products(pid, p_name), supplier:suppliers(s_name)')
          .eq('po_id', params.order_id)
          .single();
        order = data;
      } else if (params.product) {
        // Find order by product name
        const { data: orders } = await supabase
          .from('orders')
          .select('*, product:products(pid, p_name), supplier:suppliers(s_name)')
          .in('status', ['pending', 'approved', 'ordered', 'shipped']);
        
        if (orders && orders.length > 0) {
          const productSearch = params.product.toLowerCase();
          const matchingOrders = orders.filter((o: any) => {
            const productName = (o.product as any)?.p_name?.toLowerCase() || '';
            return productName.includes(productSearch) || productSearch.includes(productName.split(' ')[0]);
          });
          
          if (matchingOrders.length === 1) {
            order = matchingOrders[0];
          } else if (matchingOrders.length > 1) {
            const orderList = matchingOrders.slice(0, 5).map((o: any) => 
              `Order #${o.po_id}: ${o.quantity}x ${(o.product as any)?.p_name} (${o.status})`
            ).join('\n');
            
            return { 
              action, 
              success: false, 
              message: `Multiple orders found for "${params.product}". Please specify which one:\n${orderList}\n\nTry: "${params.status} order #<ID>"`
            };
          }
        }
      }

      if (!order) {
        return { action, success: false, message: `Could not find order${params.order_id ? ` #${params.order_id}` : params.product ? ` for "${params.product}"` : ''}` };
      }

      // Handle reorder - create a new order with same details
      if (params.status === 'reordered') {
        const { data: newOrder, error: createError } = await supabase
          .from('orders')
          .insert({
            quantity: order.quantity,
            p_id: order.p_id,
            sup_id: order.sup_id,
            target_w_id: order.target_w_id,
            price: order.price,
            created_by: employeeId,
            status: 'pending'
          })
          .select()
          .single();

        if (createError) {
          return { action, success: false, message: 'Failed to create reorder' };
        }

        // Mark original as reordered
        await supabase
          .from('orders')
          .update({ status: 'reordered', updated_at: new Date().toISOString() })
          .eq('po_id', order.po_id);

        return { 
          action, 
          success: true, 
          message: `Reordered! Created new order #${newOrder.po_id} for ${order.quantity}x ${(order.product as any)?.p_name}. Original order #${order.po_id} marked as reordered.`,
          requiresBillUpload: true,
          orderId: newOrder.po_id
        };
      }

      // Regular status update
      const { error } = await supabase
        .from('orders')
        .update({ status: params.status, updated_at: new Date().toISOString() })
        .eq('po_id', order.po_id);

      if (error) {
        return { action, success: false, message: 'Failed to update order' };
      }

      const statusMessages: Record<string, string> = {
        cancelled: `Order #${order.po_id} for ${(order.product as any)?.p_name} has been cancelled.`,
        approved: `Order #${order.po_id} for ${(order.product as any)?.p_name} has been approved.`,
        shipped: `Order #${order.po_id} for ${(order.product as any)?.p_name} marked as shipped.`,
        pending: `Order #${order.po_id} for ${(order.product as any)?.p_name} set back to pending.`,
        ordered: `Order #${order.po_id} for ${(order.product as any)?.p_name} marked as ordered.`
      };

      return { 
        action, 
        success: true, 
        message: statusMessages[params.status] || `Updated order #${order.po_id} status to ${params.status}`,
        requiresBillUpload: false,
        orderId: order.po_id
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

    case 'MOVE_PRODUCT': {
      const product = await findProduct(supabase, params.product);
      const toWarehouse = await findWarehouse(supabase, params.to_warehouse);
      
      if (!product) {
        return { action, success: false, message: `Could not find product: ${params.product}` };
      }
      if (!toWarehouse) {
        return { action, success: false, message: `Could not find destination warehouse: ${params.to_warehouse}` };
      }

      const quantity = params.quantity || 1;
      
      let fromWarehouse = null;
      if (params.from_warehouse) {
        fromWarehouse = await findWarehouse(supabase, params.from_warehouse);
      } else {
        const { data: stockLocations } = await supabase
          .from('product_warehouse')
          .select('w_id, stock, warehouse:warehouses(w_id, w_name, address)')
          .eq('pid', product.pid)
          .gte('stock', quantity)
          .order('stock', { ascending: false });
        
        if (stockLocations && stockLocations.length > 0) {
          const preferredLocation = stockLocations.find((loc: any) => loc.w_id !== toWarehouse.w_id);
          const location = preferredLocation || stockLocations[0];
          fromWarehouse = location.warehouse;
        }
      }

      if (!fromWarehouse) {
        const { data: existingStock } = await supabase
          .from('product_warehouse')
          .select('stock, warehouse:warehouses(w_name)')
          .eq('pid', product.pid)
          .gt('stock', 0);
        
        const locations = existingStock?.map((s: any) => `${s.warehouse?.w_name} (${s.stock} units)`).join(', ') || 'nowhere';
        return { 
          action, 
          success: false, 
          message: `Could not find sufficient stock of ${product.p_name}. Current locations: ${locations}` 
        };
      }

      if (fromWarehouse.w_id === toWarehouse.w_id) {
        return { action, success: false, message: `Product is already in ${toWarehouse.w_name}` };
      }

      const { data: sourceStock } = await supabase
        .from('product_warehouse')
        .select('stock')
        .eq('pid', product.pid)
        .eq('w_id', fromWarehouse.w_id)
        .single();

      if (!sourceStock || sourceStock.stock < quantity) {
        return { action, success: false, message: `Insufficient stock at ${fromWarehouse.w_name}. Available: ${sourceStock?.stock || 0}` };
      }

      await supabase
        .from('product_warehouse')
        .update({ stock: sourceStock.stock - quantity })
        .eq('pid', product.pid)
        .eq('w_id', fromWarehouse.w_id);

      const { data: destStock } = await supabase
        .from('product_warehouse')
        .select('stock')
        .eq('pid', product.pid)
        .eq('w_id', toWarehouse.w_id)
        .maybeSingle();

      if (destStock) {
        await supabase
          .from('product_warehouse')
          .update({ stock: destStock.stock + quantity })
          .eq('pid', product.pid)
          .eq('w_id', toWarehouse.w_id);
      } else {
        await supabase
          .from('product_warehouse')
          .insert({ pid: product.pid, w_id: toWarehouse.w_id, stock: quantity });
      }

      await supabase.from('transactions').insert({
        amt: quantity,
        type: 'transfer',
        pid: product.pid,
        w_id: fromWarehouse.w_id,
        target_w_id: toWarehouse.w_id,
        e_id: employeeId,
        description: `Moved ${quantity} units of ${product.p_name} from ${fromWarehouse.w_name} to ${toWarehouse.w_name}`
      });

      return { 
        action, 
        success: true, 
        message: `Moved ${quantity} units of ${product.p_name} from ${fromWarehouse.w_name} to ${toWarehouse.w_name}` 
      };
    }

    case 'TRANSFER_STOCK': {
      const product = await findProduct(supabase, params.product);
      const fromWarehouse = await findWarehouse(supabase, params.from_warehouse);
      const toWarehouse = await findWarehouse(supabase, params.to_warehouse);
      
      if (!product || !fromWarehouse || !toWarehouse) {
        return { action, success: false, message: 'Could not find product or warehouse(s)' };
      }

      const { data: sourceStock } = await supabase
        .from('product_warehouse')
        .select('stock')
        .eq('pid', product.pid)
        .eq('w_id', fromWarehouse.w_id)
        .single();

      if (!sourceStock || sourceStock.stock < params.quantity) {
        return { action, success: false, message: 'Insufficient stock at source warehouse' };
      }

      await supabase
        .from('product_warehouse')
        .update({ stock: sourceStock.stock - params.quantity })
        .eq('pid', product.pid)
        .eq('w_id', fromWarehouse.w_id);

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
  
  const { data: exactMatch } = await supabase
    .from('products')
    .select('*')
    .ilike('p_name', identifier)
    .limit(1)
    .maybeSingle();
  
  if (exactMatch) return exactMatch;
  
  const { data } = await supabase
    .from('products')
    .select('*')
    .ilike('p_name', `%${identifier}%`)
    .limit(1)
    .maybeSingle();
  return data;
}

async function findProductExact(supabase: any, identifier: string | number) {
  if (typeof identifier === 'number') {
    const { data } = await supabase.from('products').select('*').eq('pid', identifier).single();
    return data;
  }
  
  const { data } = await supabase
    .from('products')
    .select('*')
    .ilike('p_name', identifier)
    .limit(1)
    .maybeSingle();
  return data;
}

async function findSimilarProducts(supabase: any, identifier: string) {
  const searchTerm = identifier.toLowerCase();
  
  const { data: allProducts } = await supabase
    .from('products')
    .select('pid, p_name, unit_price')
    .limit(100);
  
  if (!allProducts) return [];
  
  const words = searchTerm.split(/\s+/).filter(w => w.length > 2);
  
  const similar = allProducts.filter((p: any) => {
    const name = p.p_name.toLowerCase();
    return words.some(word => name.includes(word) || word.includes(name.split(/\s+/)[0]));
  });
  
  return similar.slice(0, 5);
}

async function findWarehouse(supabase: any, identifier: string | number) {
  if (typeof identifier === 'number') {
    const { data } = await supabase.from('warehouses').select('*').eq('w_id', identifier).single();
    return data;
  }
  
  const { data: exactMatch } = await supabase
    .from('warehouses')
    .select('*')
    .ilike('w_name', identifier)
    .limit(1)
    .maybeSingle();
  
  if (exactMatch) return exactMatch;
  
  const { data } = await supabase
    .from('warehouses')
    .select('*')
    .ilike('w_name', `%${identifier}%`)
    .limit(1)
    .maybeSingle();
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
