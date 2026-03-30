
const tokenCache = new Map();

async function getAccessToken(tenantId) {
  const tid = tenantId || process.env.AZURE_TENANT_ID;

  const cached = tokenCache.get(tid);
  if (cached && Date.now() < cached.expiry) return cached.token;

  const res = await axios.post(
    `https://login.microsoftonline.com/${tid}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET,
      scope:         'https://graph.microsoft.com/.default',
    }),
    { timeout: 10000 }
  );

  tokenCache.set(tid, {
    token:  res.data.access_token,
    expiry: Date.now() + (res.data.expires_in - 60) * 1000,
  });

  return res.data.access_token;
}

module.exports = { getAccessToken };