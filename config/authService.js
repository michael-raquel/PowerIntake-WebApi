// const axios = require('axios');

// let cachedToken = null;
// let tokenExpiry = null;

// async function getAccessToken() {
//   if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
//     return cachedToken;
//   }

//   const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;

//   const res = await axios.post(
//     `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
//     new URLSearchParams({
//       grant_type: 'client_credentials',
//       client_id: AZURE_CLIENT_ID,
//       client_secret: AZURE_CLIENT_SECRET,
//       scope: 'https://graph.microsoft.com/.default',
//     }),
//     { timeout: 10000 }
//   );

//   cachedToken = res.data.access_token;
//   tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;

//   return cachedToken;
// }

// module.exports = { getAccessToken };

const axios = require('axios');

const tokenCache = {};

async function getAccessToken(tenantId) {
  const { AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;

  const target = tenantId || process.env.AZURE_TENANT_ID;

  const cached = tokenCache[target];
  if (cached && Date.now() < cached.expiry) {
    return cached.token;
  }

  const res = await axios.post(
    `https://login.microsoftonline.com/${target}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     AZURE_CLIENT_ID,
      client_secret: AZURE_CLIENT_SECRET,
      scope:         'https://graph.microsoft.com/.default',
    }),
    { timeout: 10000 }
  );

  tokenCache[target] = {
    token:  res.data.access_token,
    expiry: Date.now() + (res.data.expires_in - 60) * 1000,
  };

  return tokenCache[target].token;
}

module.exports = { getAccessToken };