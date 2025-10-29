export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-xsrf-token, host-session-id, membercode, request-owner, X-TMS-Cookies'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Extract the path after /api/tmsapi
    const path = req.url.replace('/api/tmsapi', '');
    
    // Get custom cookies from header
    const customCookies = req.headers['x-tms-cookies'];
    
    // Build headers for TMS API
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
    };

    // Add authentication headers
    if (req.headers['x-xsrf-token']) {
      headers['x-xsrf-token'] = req.headers['x-xsrf-token'];
    }
    if (req.headers['host-session-id']) {
      headers['host-session-id'] = req.headers['host-session-id'];
    }
    if (req.headers['membercode']) {
      headers['membercode'] = req.headers['membercode'];
    }
    if (req.headers['request-owner']) {
      headers['request-owner'] = req.headers['request-owner'];
    }

    // Inject cookies from custom header
    if (customCookies) {
      headers['Cookie'] = customCookies;
    }

    console.log('[Vercel API] Request:', {
      method: req.method,
      path: path,
      hasCookies: !!customCookies,
      hasXsrfToken: !!req.headers['x-xsrf-token'],
      hasSessionId: !!req.headers['host-session-id'],
    });

    // Make request to TMS API
    const tmsUrl = `https://tms56.nepsetms.com.np/tmsapi${path}`;
    const options = {
      method: req.method,
      headers: headers,
    };

    // Add body for POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT') {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(tmsUrl, options);
    const data = await response.json();

    console.log('[Vercel API] Response:', {
      status: response.status,
      url: tmsUrl,
      success: response.ok,
    });

    // For refresh endpoint, extract and return cookies
    if (path.includes('/authApi/authenticate/refresh') && response.ok) {
      console.log('[Vercel API] Refresh response - extracting cookies');
      
      // Extract all set-cookie headers (fetch API can have multiple)
      const cookies = [];
      response.headers.forEach((value, name) => {
        if (name.toLowerCase() === 'set-cookie') {
          cookies.push(value);
        }
      });
      
      if (cookies.length > 0) {
        console.log('[Vercel API] Found cookies:', cookies.length);
        // Add cookies to response data so client can update them
        data._cookies = cookies;
      } else {
        console.warn('[Vercel API] No cookies found in refresh response');
      }
    }

    // Forward the response
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Vercel API] Error:', error);
    res.status(500).json({
      status: '500',
      level: 'ERROR',
      message: error.message,
      data: null,
    });
  }
}
