import type { NextApiRequest, NextApiResponse } from 'next';

const JIRA_DOMAIN = 'bravebits.jira.com';

type ErrorResponse = {
  error: string;
  status?: number;
  detail?: unknown;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<unknown | ErrorResponse>
) {
  // Get credentials from environment variables
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!email || !apiToken) {
    return res.status(500).json({ 
      error: 'Missing JIRA_EMAIL or JIRA_API_TOKEN environment variables' 
    });
  }

  try {
    // Create base64 encoded Basic Auth token
    const authToken = Buffer.from(`${email}:${apiToken}`).toString('base64');

    // Get the path segments from the dynamic route
    const { path } = req.query;
    const pathSegments = Array.isArray(path) ? path : [path];
    const jiraPath = pathSegments.join('/');

    // Build the full Jira API URL
    const url = new URL(`https://${JIRA_DOMAIN}/rest/api/3/${jiraPath}`);

    // Add query parameters (excluding the path parameter)
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'path') {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v));
        } else if (value !== undefined) {
          url.searchParams.append(key, value as string);
        }
      }
    });

    // Log the final URL being called
    console.log(`[Jira API] Calling: ${url.toString()}`);
    console.log(`[Jira API] Method: ${req.method}`);

    // Prepare headers
    const headers: HeadersInit = {
      'Authorization': `Basic ${authToken}`,
      'Content-Type': 'application/json',
    };

    // Forward relevant headers from the original request
    Object.entries(req.headers).forEach(([key, value]) => {
      if (
        !['host', 'content-length', 'connection', 'authorization'].includes(key.toLowerCase()) &&
        value !== undefined
      ) {
        headers[key] = value as string;
      }
    });

    // Log headers (excluding Authorization)
    const logHeaders = { ...headers };
    delete logHeaders['Authorization'];
    console.log('[Jira API] Headers:', logHeaders);

    // Prepare request options
    const requestOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Add body for non-GET requests
    if (req.method !== 'GET' && req.body) {
      requestOptions.body = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);
      console.log('[Jira API] Request Body:', requestOptions.body);
    }

    // Forward the request to Jira API
    const jiraResponse = await fetch(url.toString(), requestOptions);
    
    // Get response data
    const responseData = await jiraResponse.text();
    
    // Log the raw response
    console.log(`[Jira API] Response Status: ${jiraResponse.status}`);
    console.log('[Jira API] Response Headers:', Object.fromEntries(jiraResponse.headers.entries()));
    console.log('[Jira API] Response Body:', responseData);

    // Handle non-2xx responses
    if (!jiraResponse.ok) {
      let detail;
      try {
        detail = JSON.parse(responseData);
      } catch {
        detail = responseData;
      }

      return res.status(jiraResponse.status).json({
        error: 'Jira API request failed',
        status: jiraResponse.status,
        detail
      });
    }

    // Set response status code
    res.status(jiraResponse.status);

    // Forward response headers
    jiraResponse.headers.forEach((value, key) => {
      if (!['content-length', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Return response
    if (responseData) {
      try {
        const parsedData = JSON.parse(responseData);
        return res.json(parsedData);
      } catch {
        return res.send(responseData);
      }
    } else {
      return res.end();
    }
  } catch (error) {
    console.error('[Jira API] Proxy Error:', error);
    return res.status(500).json({
      error: 'Failed to proxy request to Jira API',
      status: 500,
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 