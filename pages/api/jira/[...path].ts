import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Extract authorization token
  const authHeader = req.headers.authorization;
  const cloudId = "920347bb-e31b-4d93-aacf-723f318dddb0";

  if (!authHeader?.startsWith('Bearer ') || !cloudId) {
    return res.status(401).json({ error: 'Missing authorization token or cloud ID' });
  }

  const accessToken = authHeader.substring(7);

  try {
    // Get the path segments from the dynamic route
    const { path } = req.query;
    const pathSegments = Array.isArray(path) ? path : [path];
    const jiraPath = pathSegments.join('/');

    // Build the full Jira API URL
    const url = new URL(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/${jiraPath}`);

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

    // Prepare headers
    const headers: HeadersInit = {
      'Authorization': `Bearer ${accessToken}`,
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
    }

    // Forward the request to Jira API
    const jiraResponse = await fetch(url.toString(), requestOptions);
    
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
    console.error('Jira API proxy error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to proxy request to Jira API'
    });
  }
} 