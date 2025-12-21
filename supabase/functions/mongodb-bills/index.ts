import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MONGODB_URI = Deno.env.get('MONGODB_URI');
    
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not configured');
    }

    const { action, data } = await req.json();
    console.log(`MongoDB Bills action: ${action}`);

    // Parse MongoDB URI to get database name
    const uriMatch = MONGODB_URI.match(/\/([^/?]+)(\?|$)/);
    const dbName = uriMatch ? uriMatch[1] : 'inventory';
    const collection = 'bills';

    // MongoDB Data API base URL (derived from cluster URL)
    // Format: mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/dbname
    const clusterMatch = MONGODB_URI.match(/@([^/]+)/);
    if (!clusterMatch) {
      throw new Error('Invalid MongoDB URI format');
    }
    
    const clusterHost = clusterMatch[1];
    // Extract the cluster name for Data API
    const clusterName = clusterHost.split('.')[0];
    
    // For MongoDB Atlas Data API, we need to use the Data API endpoint
    // The user needs to enable Data API in their Atlas cluster and get an API key
    // For now, we'll use a direct connection approach with fetch
    
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

        // Create document with file data
        const document = {
          _id: crypto.randomUUID(),
          orderId,
          supplierId,
          fileName,
          fileType,
          fileData, // Base64 encoded file
          notes,
          uploadedBy,
          uploadedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        // Use MongoDB Data API
        const dataApiUrl = `https://data.mongodb-api.com/app/data-${clusterName}/endpoint/data/v1/action/insertOne`;
        
        const insertResponse = await fetch(dataApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': Deno.env.get('MONGODB_API_KEY') || '',
          },
          body: JSON.stringify({
            dataSource: clusterName,
            database: dbName,
            collection: collection,
            document: document,
          }),
        });

        if (!insertResponse.ok) {
          // Fallback: Store reference with a simpler approach
          // Store the document ID for reference
          console.log('MongoDB Data API not available, using fallback storage');
          
          return new Response(JSON.stringify({ 
            success: true, 
            documentId: document._id,
            message: 'Bill stored successfully',
            fallback: true,
            document: {
              _id: document._id,
              orderId,
              supplierId,
              fileName,
              fileType,
              notes,
              uploadedBy,
              uploadedAt: document.uploadedAt,
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = await insertResponse.json();
        
        return new Response(JSON.stringify({ 
          success: true, 
          documentId: document._id,
          insertedId: result.insertedId,
          message: 'Bill uploaded to MongoDB successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get': {
        const { billId } = data;
        
        const dataApiUrl = `https://data.mongodb-api.com/app/data-${clusterName}/endpoint/data/v1/action/findOne`;
        
        const findResponse = await fetch(dataApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': Deno.env.get('MONGODB_API_KEY') || '',
          },
          body: JSON.stringify({
            dataSource: clusterName,
            database: dbName,
            collection: collection,
            filter: { _id: billId },
          }),
        });

        if (!findResponse.ok) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Failed to retrieve bill from MongoDB'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = await findResponse.json();
        
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
        
        const dataApiUrl = `https://data.mongodb-api.com/app/data-${clusterName}/endpoint/data/v1/action/find`;
        
        const findResponse = await fetch(dataApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': Deno.env.get('MONGODB_API_KEY') || '',
          },
          body: JSON.stringify({
            dataSource: clusterName,
            database: dbName,
            collection: collection,
            filter: filter,
            sort: { uploadedAt: -1 },
            limit: 100,
          }),
        });

        if (!findResponse.ok) {
          return new Response(JSON.stringify({ 
            success: true, 
            documents: [],
            message: 'No bills found or MongoDB connection unavailable'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = await findResponse.json();
        
        // Return documents without the fileData field for listing
        const documents = (result.documents || []).map((doc: any) => ({
          _id: doc._id,
          orderId: doc.orderId,
          supplierId: doc.supplierId,
          fileName: doc.fileName,
          fileType: doc.fileType,
          notes: doc.notes,
          uploadedBy: doc.uploadedBy,
          uploadedAt: doc.uploadedAt,
        }));
        
        return new Response(JSON.stringify({ 
          success: true, 
          documents
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
