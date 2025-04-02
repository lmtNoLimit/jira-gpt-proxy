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

type TokenRequestBody = {
  code: string;
  redirect_uri: string;
  client_id: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TokenResponse | ErrorResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as TokenRequestBody;

    // Validate required parameters in request body
    if (!body.code || !body.redirect_uri || !body.client_id) {
      return res.status(400).json({ 
        error: 'Missing required parameters: code, redirect_uri, or client_id in request body' 
      });
    }

    // Get client secret from environment variables
    const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;

    // Validate required environment variables
    if (!clientSecret) {
      return res.status(500).json({ 
        error: 'Missing required environment variable: ATLASSIAN_CLIENT_SECRET' 
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
        client_id: body.client_id,
        client_secret: clientSecret,
        code: body.code,
        redirect_uri: body.redirect_uri,
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