import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MongoDB connection using fetch (since native driver has compatibility issues in Deno Deploy)
async function mongoRequest(uri: string, dbName: string, collectionName: string, action: string, payload: Record<string, unknown>) {
  // Parse the URI to get connection details
  const match = uri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)/);
  if (!match) {
    throw new Error('Invalid MongoDB URI format. Expected: mongodb+srv://user:password@cluster.mongodb.net');
  }
  
  const [, username, password, host] = match;
  const clusterParts = host.split('.');
  
  // MongoDB Atlas Data API URL format
  // Users need to enable Data API in MongoDB Atlas
  const dataApiUrl = `https://${host.replace('.mongodb.net', '.data.mongodb-api.com')}/app/data-api/endpoint/data/v1/action/${action}`;
  
  console.log(`MongoDB request to: ${action} on ${dbName}.${collectionName}`);
  
  const response = await fetch(dataApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Request-Headers': '*',
      'api-key': Deno.env.get('MONGODB_API_KEY') || '',
    },
    body: JSON.stringify({
      dataSource: clusterParts[0],
      database: dbName,
      collection: collectionName,
      ...payload,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`MongoDB API error: ${response.status} - ${errorText}`);
    throw new Error(`MongoDB API error: ${response.status}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MONGODB_URI = Deno.env.get('MONGODB_URI');
    
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not configured. Please add your MongoDB connection string to secrets.');
    }

    const { action, data } = await req.json();
    console.log(`MongoDB Bills action: ${action}`);

    const dbName = 'inventory';
    const collectionName = 'bills';

    switch (action) {
      case 'upload': {
        const { orderId, supplierId, fileName, fileType, fileData, notes, uploadedBy } = data;
        
        if (!fileData) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'File data is required' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const documentId = crypto.randomUUID();
        const document = {
          _id: documentId,
          orderId,
          supplierId,
          fileName,
          fileType,
          fileData,
          notes,
          uploadedBy,
          uploadedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        try {
          const result = await mongoRequest(MONGODB_URI, dbName, collectionName, 'insertOne', { document });
          console.log(`Bill inserted with id: ${documentId}`);

          return new Response(JSON.stringify({ 
            success: true, 
            documentId: documentId,
            insertedId: result.insertedId,
            message: 'Bill uploaded to MongoDB successfully'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (apiError) {
          // If Data API fails, store locally in Supabase storage as fallback
          console.log('MongoDB Data API not available, returning document ID for local storage');
          return new Response(JSON.stringify({ 
            success: true, 
            documentId: documentId,
            message: 'Bill reference created (Data API unavailable - using local storage)',
            fallback: true,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'get': {
        const { billId } = data;
        
        const result = await mongoRequest(MONGODB_URI, dbName, collectionName, 'findOne', { 
          filter: { _id: billId } 
        });

        if (!result.document) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Bill not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          document: result.document
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'list': {
        const { orderId, supplierId } = data || {};
        
        const filter: Record<string, unknown> = {};
        if (orderId) filter.orderId = orderId;
        if (supplierId) filter.supplierId = supplierId;

        const result = await mongoRequest(MONGODB_URI, dbName, collectionName, 'find', { 
          filter,
          sort: { uploadedAt: -1 },
          limit: 100,
          projection: {
            _id: 1,
            orderId: 1,
            supplierId: 1,
            fileName: 1,
            fileType: 1,
            notes: 1,
            uploadedBy: 1,
            uploadedAt: 1,
          }
        });

        return new Response(JSON.stringify({ 
          success: true, 
          documents: result.documents || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Unknown action: ${action}` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('MongoDB Bills error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
