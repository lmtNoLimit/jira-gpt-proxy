import type { NextApiRequest, NextApiResponse } from 'next';

type SuccessResponse = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
};

type ErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, redirect_uri, client_id } = req.body;
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;

  if (!code || !redirect_uri || !client_id || !clientSecret) {
    return res.status(500).json({ error: 'Failed to exchange token' });
  }

  try {
    // Step 1: Exchange code for access token
    const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id,
        client_secret: clientSecret,
        code,
        redirect_uri
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token || !tokenData.expires_in) {
      return res.status(500).json({ error: 'Failed to exchange token' });
    }

    // Return combined response with cloud ID
    return res.status(200).json({
      access_token: tokenData.access_token,
      token_type: 'Bearer',
      expires_in: tokenData.expires_in,
      refresh_token: tokenData.refresh_token || '',
    });
  } catch {
    return res.status(500).json({ error: 'Failed to complete authentication' });
  }
} 