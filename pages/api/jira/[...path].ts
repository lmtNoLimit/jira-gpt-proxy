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

    // Log request details
    console.log(`[Jira API] ${req.method} ${url.toString()}`);

    // Prepare headers
    const headers: HeadersInit = {
      'Authorization': `Basic ${authToken}`
    };

    // Forward all headers except host and content-length
    Object.entries(req.headers).forEach(([key, value]) => {
      if (
        !['host', 'content-length', 'connection'].includes(key.toLowerCase()) &&
        value !== undefined
      ) {
        headers[key] = value as string;
      }
    });

    // Prepare request options
    const requestOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Handle request body based on Content-Type
    const contentType = req.headers['content-type'];
    if (req.method !== 'GET' && req.body) {
      if (contentType?.includes('application/json')) {
        requestOptions.body = typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body);
        
        // Ensure Content-Type is set for JSON requests
        headers['Content-Type'] = 'application/json';
      }
      // Skip body for non-JSON requests to prevent 415 errors
    }

    // Forward the request to Jira API
    const jiraResponse = await fetch(url.toString(), requestOptions);
    
    // Log response status
    console.log(`[Jira API] Response Status: ${jiraResponse.status}`);

    // Get response data
    const responseData = await jiraResponse.text();

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