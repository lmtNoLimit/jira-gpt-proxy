import type { NextApiRequest, NextApiResponse } from 'next';

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

type ErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TokenResponse | ErrorResponse>
) {
  // Only allow POST or GET requests
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract code from query parameters
    const { code } = req.query;

    // Validate required parameters
    if (!code) {
      return res.status(400).json({ error: 'Missing required parameter: code' });
    }

    // Get environment variables
    const clientId = process.env.ATLASSIAN_CLIENT_ID;
    const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;
    const redirectUri = process.env.ATLASSIAN_REDIRECT_URI;

    // Validate required environment variables
    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({ 
        error: 'Missing required environment variables: ATLASSIAN_CLIENT_ID, ATLASSIAN_CLIENT_SECRET, or ATLASSIAN_REDIRECT_URI' 
      });
    }

    // Prepare request to Atlassian's token endpoint
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    // Parse the response
    const data = await response.json();

    // Check if the response contains an error
    if (!response.ok || data.error) {
      return res.status(response.status || 500).json({ 
        error: data.error_description || data.error || 'Failed to exchange token' 
      });
    }

    // Return the token information
    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      scope: data.scope,
      token_type: data.token_type,
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    });
  }
} 