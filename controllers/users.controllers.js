const axios = require('axios');
const { getAccessToken } = require('../config/authService');
const client = require("../config/db");

const GRAPH_URL = 'https://graph.microsoft.com/v1.0';
const USER_FIELDS = [
 
  'id',
  'displayName',
  'givenName',
  'surname',
  'mail',
  'userPrincipalName',
  'jobTitle',
  'department',
  'officeLocation',
  'mobilePhone',
  'businessPhones',
  'preferredLanguage',
  'accountEnabled',

  'ageGroup',
  'city',
  'companyName',
  'country',
  'createdDateTime',
  'mailNickname',
  'proxyAddresses',
  'state',
  'streetAddress',
  'usageLocation',
  'userType',
].join(',');

const get_AllUsers = async (req, res) => {
  try {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    let users = [];
    let nextLink = `${GRAPH_URL}/users?$select=${USER_FIELDS}&$top=999`;

    while (nextLink) {
      const response = await axios.get(nextLink, { headers, timeout: 10000 });
      users = [...users, ...response.data.value];
      nextLink = response.data["@odata.nextLink"] ?? null;
    }

    return res.status(200).json({
      count: users.length,
      users,
    });

  } catch (err) {
    console.error("get_AllUsers error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const get_UserById = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(`${GRAPH_URL}/users/${id}`, {
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
      params: { $select: USER_FIELDS },
    });

    res.status(200).json(response.data);
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
};

const get_UserManager = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(
      `${GRAPH_URL}/users/${id}/manager`,
      { headers: { Authorization: `Bearer ${await getAccessToken()}` } }
    );

    res.status(200).json(response.data);
  } catch (err) {
    const status = err.response?.status === 404 ? 404 : 500;
    res.status(status).send(status === 404 ? 'No manager found for this user' : 'Internal Server Error');
  }
};

const get_UserDirectReports = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(
      `${GRAPH_URL}/users/${id}/directReports`,
      { headers: { Authorization: `Bearer ${await getAccessToken()}` } }
    );

    res.status(200).json({
      count: response.data.value.length,
      directReports: response.data.value,
    });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
};

const get_UserFullProfile = async (req, res) => {
  try {
    const { id } = req.query;
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const [userRes, managerRes, reportsRes] = await Promise.allSettled([
      axios.get(`${GRAPH_URL}/users/${id}`, { headers, params: { $select: USER_FIELDS } }),
      axios.get(`${GRAPH_URL}/users/${id}/manager`, { headers }),
      axios.get(`${GRAPH_URL}/users/${id}/directReports`, { headers }),
    ]);

    res.status(200).json({
      user:          userRes.status    === 'fulfilled' ? userRes.value.data              : null,
      manager:       managerRes.status === 'fulfilled' ? managerRes.value.data           : null,
      directReports: reportsRes.status === 'fulfilled' ? reportsRes.value.data.value    : [],
    });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
};


const get_AllUsersWithDetails = async (req, res) => {
  try {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const usersRes = await axios.get(`${GRAPH_URL}/users`, {
      headers,
      params: { $select: USER_FIELDS, $top: 999 },
      timeout: 10000,
    });

    const users = usersRes.data.value;

    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const [managerRes, reportsRes, groupsRes, rolesRes] = await Promise.allSettled([
          axios.get(`${GRAPH_URL}/users/${user.id}/manager`, { headers }),
          axios.get(`${GRAPH_URL}/users/${user.id}/directReports`, { headers }),
          axios.get(`${GRAPH_URL}/users/${user.id}/memberOf`, {
            headers,
            params: { $select: 'id,displayName,groupTypes,securityEnabled' }
          }),
          axios.get(`${GRAPH_URL}/users/${user.id}/memberOf/microsoft.graph.directoryRole`, {
            headers,
            params: { $select: 'id,displayName,description,roleTemplateId' }
          }),
        ]);

        return {
          ...user,
          manager:       managerRes.status  === 'fulfilled' ? managerRes.value.data          : null,
          directReports: reportsRes.status  === 'fulfilled' ? reportsRes.value.data.value    : [],
          groups:        groupsRes.status   === 'fulfilled' ? groupsRes.value.data.value     : [],
          roles:         rolesRes.status    === 'fulfilled' ? rolesRes.value.data.value      : [],
        };
      })
    );

    return res.status(200).json({
      count: enrichedUsers.length,
      users: enrichedUsers,
    });

  } catch (err) {
    console.error("get_AllUsersWithDetails error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const get_UserGroups = async (req, res) => {
  try {
    const { id } = req.query;
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const [directRes, transitiveRes] = await Promise.allSettled([
      axios.get(`${GRAPH_URL}/users/${id}/memberOf`, {
        headers,
        params: { $select: 'id,displayName,groupTypes,securityEnabled,mail' },
      }),
      axios.get(`${GRAPH_URL}/users/${id}/transitiveMemberOf/microsoft.graph.group`, {
        headers,
        params: { $select: 'id,displayName,groupTypes,securityEnabled,mail' },
      }),
    ]);

    res.status(200).json({
      directGroups:     directRes.status     === 'fulfilled' ? directRes.value.data.value     : [],
      transitiveGroups: transitiveRes.status === 'fulfilled' ? transitiveRes.value.data.value : [],
    });

  } catch (err) {

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const get_UserAppRoleAssignments = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(`${GRAPH_URL}/users/${id}/appRoleAssignments`, {
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
      params: { $select: 'id,appRoleId,resourceId,resourceDisplayName,principalId' },
    });

    res.status(200).json({
      count: response.data.value.length,
      appRoleAssignments: response.data.value,
    });

  } catch (err) {
    console.error("get_UserAppRoleAssignments error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const sync_Users = async (req, res) => {
  try {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const orgRes = await axios.get(`${GRAPH_URL}/organization`, { headers });
    const entraTenantId     = orgRes.data.value?.[0]?.id ?? null;
    const tenantName        = orgRes.data.value?.[0]?.displayName ?? null;
    const tenantEmailDomain = orgRes.data.value?.[0]?.verifiedDomains?.find(d => d.isDefault)?.name ?? null;

    let graphUsers = [];
    let nextLink = `${GRAPH_URL}/users?$select=${USER_FIELDS}&$top=999`;
    while (nextLink) {
      const response = await axios.get(nextLink, { headers, timeout: 10000 });
      graphUsers = [...graphUsers, ...response.data.value];
      nextLink = response.data["@odata.nextLink"] ?? null;
    }

    if (graphUsers.length === 0) {
      return res.status(200).json({ message: "No users found in Microsoft Graph.", synced: 0 });
    }

    const existingResult = await client.query("SELECT * FROM public.user_email_get()");
    const existingEmails  = new Set(existingResult.rows.map((r) => r.v_useremail));

    const newUsers = graphUsers.filter((user) => {
      const email = user.mail ?? user.userPrincipalName ?? null;
      if (!email) return false;
      return !existingEmails.has(email.toLowerCase());
    });

    if (newUsers.length === 0) {
      return res.status(200).json({
        message: "All users are already synced.",
        total: graphUsers.length,
        synced: 0,
        skipped: graphUsers.length,
      });
    }

    let synced  = 0;
    let skipped = 0;

    for (const user of newUsers) {
      const email = user.mail ?? user.userPrincipalName ?? null;
      if (!email) { skipped++; continue; }

      try {
        await client.query(
          "SELECT public.user_sync($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            user.id,
            entraTenantId,
            user.displayName         ?? null,
            user.jobTitle            ?? null,
            user.businessPhones?.[0] ?? null,
            email,
            user.department          ?? null,
            user.mobilePhone         ?? null,
            user.createdDateTime     ?? null,
            tenantName,
            tenantEmailDomain,
          ]
        );
        synced++;
      } catch (userErr) {
        console.error(`Failed to sync user ${email}:`, userErr.message);
        skipped++;
      }
    }

    const managerPairs = [];

    await Promise.allSettled(
      newUsers.map(async (user) => {
        try {
          const managerRes = await axios.get(`${GRAPH_URL}/users/${user.id}/manager`, { headers });
          const managerEntraId = managerRes.data?.id ?? null;
          if (managerEntraId) {
            managerPairs.push({
              userEntraId: user.id,
              managerEntraId,
            });
          }
        } catch {
         
        }
      })
    );

    let managersResolved = 0;
    let managersFailed   = 0;

    for (const pair of managerPairs) {
      try {
        await client.query(
          "SELECT public.user_sync_managers($1, $2)",
          [pair.userEntraId, pair.managerEntraId]
        );
        managersResolved++;
      } catch (err) {
        console.error(`Failed to set manager for ${pair.userEntraId}:`, err.message);
        managersFailed++;
      }
    }

    return res.status(200).json({
      message: "Sync completed.",
      total:            graphUsers.length,
      new:              newUsers.length,
      synced,
      skipped,
      managersResolved,
      managersFailed,
    });

  } catch (err) {
    console.error("sync_Users error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: err.message });
  }
};

const sync_AllTenantUsers = async (req, res) => {
  try {
    const tenantsResult = await client.query("SELECT * FROM public.tenant_get()");
    const tenants = tenantsResult.rows;

    if (tenants.length === 0) {
      return res.status(200).json({ message: "No tenants configured with credentials." });
    }

    const results = [];

    for (const tenant of tenants) {
      try {
        const tokenRes = await axios.post(
          `https://login.microsoftonline.com/${tenant.v_entratenantid}/oauth2/v2.0/token`,
          new URLSearchParams({
            grant_type:    "client_credentials",
            client_id:     tenant.v_clientid,
            client_secret: tenant.v_clientsecret,
            scope:         "https://graph.microsoft.com/.default",
          })
        );

        const token = tokenRes.data.access_token;
        const headers = { Authorization: `Bearer ${token}` };

        let graphUsers = [];
        let nextLink = `${GRAPH_URL}/users?$select=${USER_FIELDS}&$top=999`;

        while (nextLink) {
          const response = await axios.get(nextLink, { headers, timeout: 10000 });
          graphUsers = [...graphUsers, ...response.data.value];
          nextLink = response.data["@odata.nextLink"] ?? null;
        }

        if (graphUsers.length === 0) {
          results.push({ tenant: tenant.v_tenantname, message: "No users found.", synced: 0 });
          continue;
        }

        const existingResult = await client.query("SELECT * FROM public.user_email_get()");
        const existingEmails = new Set(existingResult.rows.map((r) => r.v_useremail));

        const newUsers = graphUsers.filter((user) => {
          const email = user.mail ?? user.userPrincipalName ?? null;
          if (!email) return false;
          return !existingEmails.has(email.toLowerCase());
        });

        if (newUsers.length === 0) {
          results.push({
            tenant: tenant.v_tenantname,
            message: "All users already synced.",
            total: graphUsers.length,
            synced: 0,
          });
          continue;
        }

        let synced = 0;
        let skipped = 0;

        for (const user of newUsers) {
          const email = user.mail ?? user.userPrincipalName ?? null;
          if (!email) { skipped++; continue; }

          try {
            await client.query(
              "SELECT public.user_sync($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
              [
                user.id,
                tenant.v_entratenantid,
                user.displayName ?? null,
                user.jobTitle ?? null,
                user.businessPhones?.[0] ?? null,
                email,
                user.department ?? null,
                user.mobilePhone ?? null,
                user.createdDateTime ?? null,
                tenant.v_tenantname,
                tenant.v_tenantemail,
              ]
            );
            synced++;
          } catch (userErr) {
            console.error(`Failed to sync user ${email}:`, userErr.message);
            skipped++;
          }
        }

        results.push({
          tenant: tenant.v_tenantname,
          total: graphUsers.length,
          new: newUsers.length,
          synced,
          skipped,
        });

      } catch (tenantErr) {
        console.error(`Failed to sync tenant ${tenant.v_tenantname}:`, tenantErr.message);
        results.push({
          tenant: tenant.v_tenantname,
          error: tenantErr.message,
        });
      }
    }

    return res.status(200).json({
      message: "Multi-tenant sync completed.",
      total_tenants: tenants.length,
      results,
    });

  } catch (err) {
    console.error("sync_AllTenantUsers error:", err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error?.message || "Graph API Error",
      });
    }

    if (err.request) {
      return res.status(504).json({
        error: "No response from Microsoft Graph (Timeout or Network Issue)",
      });
    }

    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  get_AllUsers,
  get_UserById,
  get_UserManager,
  get_UserDirectReports,
  get_UserFullProfile,
  get_AllUsersWithDetails,
  get_UserGroups,
  get_UserAppRoleAssignments,
  sync_Users,
  sync_AllTenantUsers,
};