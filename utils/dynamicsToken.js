const axios = require("axios");

const tokenCache = {};

const getDynamicsToken = async (tenantId = null) => {
    const resolvedTenantId = tenantId || process.env.AZURE_TENANT_ID;
    const cached = tokenCache[resolvedTenantId];

    if (cached && Date.now() < cached.expiry - 5 * 60 * 1000) {
        return cached.token;
    }

    const params = new URLSearchParams();
    params.append("grant_type",    "client_credentials");
    params.append("client_id",     process.env.AZURE_CLIENT_ID);
    params.append("client_secret", process.env.AZURE_CLIENT_SECRET);
    params.append("scope",         `${process.env.DYNAMICS_URL}/.default`);

    const response = await axios.post(
        `https://login.microsoftonline.com/${resolvedTenantId}/oauth2/v2.0/token`,
        params.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    tokenCache[resolvedTenantId] = {
        token:  response.data.access_token,
        expiry: Date.now() + response.data.expires_in * 1000,
    };

    console.log(`Dynamics token refreshed for tenant: ${resolvedTenantId}`);
    return tokenCache[resolvedTenantId].token;
};

module.exports = { getDynamicsToken };