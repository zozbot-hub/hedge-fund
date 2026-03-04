addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const VDS_API = 'http://217.76.56.212:5000';
  
  // Get the URL path
  const url = new URL(request.url);
  const targetUrl = VDS_API + url.pathname + url.search;
  
  // Create new request headers
  const headers = new Headers(request.headers);
  headers.delete('host');
  
  try {
    // Forward request to VDS
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body
    });
    
    // Create response with CORS headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to connect to API',
      message: error.message
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
