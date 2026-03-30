const axios = require('axios');
const { getAccessToken } = require('../config/authService');
const { resolveRoleName } = require('../config/groupRoleMap');
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
    const token = await getAccessToken(req.tenantId);
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
      headers: { Authorization: `Bearer ${await getAccessToken(req.tenantId)}` },
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
      { headers: { Authorization: `Bearer ${await getAccessToken(req.tenantId)}` } }
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
      { headers: { Authorization: `Bearer ${await getAccessToken(req.tenantId)}` } }
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
    const token = await getAccessToken(req.tenantId);
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
    const token = await getAccessToken(req.tenantId);
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
    const token = await getAccessToken(req.tenantId);
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
      headers: { Authorization: `Bearer ${await getAccessToken(req.tenantId)}` },
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

const get_UserFromDb = async (req, res) => {
  try {
    const { useruuid, entrauserid, tenantuuid } = req.query;

    const result = await client.query(
      "SELECT * FROM user_get($1, $2, $3)",
      [useruuid || null, entrauserid || null, tenantuuid || null]
    );

    return res.status(200).json(result.rows);

  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const get_User_Info = async (req, res) => {
    try {
        const { entrauserid } = req.query;

        if (!entrauserid) {
            return res.status(400).json({ error: "entrauserid is required" });
        }

        const result = await client.query(
            `SELECT * FROM public.user_get_info($1)`,
            [entrauserid]
        );

        return res.status(200).json(result.rows);
    } catch (err) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const update_UserRole = async (req, res) => {
  try {
    const { entrauserid, userrole, modifiedby } = req.body;

    const result = await client.query(
      "SELECT public.user_update_role($1, $2, $3)",
      [entrauserid, userrole, modifiedby]
    );

    const useruuid = result.rows[0]?.user_update_role || null;

    return res.status(200).json({ useruuid });
  } catch (err) {
    console.error("update_UserRole error:", err.message);

    if (err.message) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const ROLE_PRIORITY = ["SuperAdmin", "Admin", "Manager", "User"];

const fetchRolesBatch = async (users, headers) => {
    const roleMap   = {};
    const chunkSize = 20;

    for (let i = 0; i < users.length; i += chunkSize) {
        const chunk = users.slice(i, i + chunkSize);

        const batchBody = {
            requests: chunk.map((user, idx) => ({
                id:     String(idx),
                method: "GET",
                url:    `/users/${user.id}/appRoleAssignments`,
            })),
        };

        try {
            const batchRes = await axios.post(
                "https://graph.microsoft.com/v1.0/$batch",
                batchBody,
                { headers: { ...headers, "Content-Type": "application/json" } }
            );

            for (const response of batchRes.data.responses) {
                const user  = chunk[parseInt(response.id)];
                const value = response.body?.value ?? [];

                const roles = value
                    .map(r => resolveRoleName(r.appRoleId))
                    .filter(Boolean)
                    .sort((a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b));

                roleMap[user.id] = roles.length > 0 ? roles.join(", ") : "User";
                // roleMap[user.id] = roles.length > 0 ? roles[0] : "User";
            }
        } catch (e) {
            console.error(`[SYNC] Batch roles fetch failed for chunk ${i}:`, e.message);
            chunk.forEach(u => { roleMap[u.id] = "User"; });
        }

        console.log(`[SYNC] Roles fetched: ${Math.min(i + chunkSize, users.length)}/${users.length}`);
    }

    return roleMap;
};

const fetchManagersBatch = async (users, headers) => {
    const managerPairs = [];
    const chunkSize    = 20;

    for (let i = 0; i < users.length; i += chunkSize) {
        const chunk = users.slice(i, i + chunkSize);

        const batchBody = {
            requests: chunk.map((user, idx) => ({
                id:     String(idx),
                method: "GET",
                url:    `/users/${user.id}/manager`,
            })),
        };

        try {
            const batchRes = await axios.post(
                "https://graph.microsoft.com/v1.0/$batch",
                batchBody,
                { headers: { ...headers, "Content-Type": "application/json" } }
            );

            for (const response of batchRes.data.responses) {
                if (response.status !== 200) continue;
                const user           = chunk[parseInt(response.id)];
                const managerEntraId = response.body?.id ?? null;
                if (managerEntraId) {
                    managerPairs.push({ userEntraId: user.id, managerEntraId });
                }
            }
        } catch (e) {
            console.error(`[SYNC] Batch managers fetch failed for chunk ${i}:`, e.message);
        }

        console.log(`[SYNC] Managers fetched: ${Math.min(i + chunkSize, users.length)}/${users.length}`);
    }

    return managerPairs;
};

const sync_Users = async (req, res) => {
    try {
        const token   = await getAccessToken(req.tenantId);
        const headers = { Authorization: `Bearer ${token}` };

        const orgRes            = await axios.get(`${GRAPH_URL}/organization`, { headers });
        const entraTenantId     = orgRes.data.value?.[0]?.id ?? null;
        const tenantName        = orgRes.data.value?.[0]?.displayName ?? null;
        const tenantEmailDomain = orgRes.data.value?.[0]?.verifiedDomains?.find(d => d.isDefault)?.name ?? null;

        let graphUsers = [];
        let nextLink   = `${GRAPH_URL}/users?$select=${USER_FIELDS}&$top=999`;

        while (nextLink) {
            const response = await axios.get(nextLink, { headers, timeout: 10000 });
            graphUsers     = [...graphUsers, ...response.data.value];
            nextLink       = response.data["@odata.nextLink"] ?? null;
        }

        if (graphUsers.length === 0) {
            return res.status(200).json({ message: "No users found in Microsoft Graph.", synced: 0 });
        }

        console.log(`[SYNC] Fetched ${graphUsers.length} users from Graph`);

        const roleMap = await fetchRolesBatch(graphUsers, headers);

        const validUsers = graphUsers.filter(u => u.mail ?? u.userPrincipalName);

        const entrauserids   = validUsers.map(u => u.id);
        const entratenantids = validUsers.map(() => entraTenantId);
        const usernames      = validUsers.map(u => u.displayName         ?? null);
        const jobtitles      = validUsers.map(u => u.jobTitle            ?? null);
        const businessphones = validUsers.map(u => u.businessPhones?.[0] ?? null);
        const useremails     = validUsers.map(u => u.mail ?? u.userPrincipalName ?? null);
        const departments    = validUsers.map(u => u.department          ?? null);
        const mobilephones   = validUsers.map(u => u.mobilePhone         ?? null);
        const createddates   = validUsers.map(u => u.createdDateTime     ?? null);
        const tenantnames    = validUsers.map(() => tenantName);
        const tenantemails   = validUsers.map(() => tenantEmailDomain);
        const userroles      = validUsers.map(u => roleMap[u.id]         ?? "User");
        const statuses       = validUsers.map(u => u.accountEnabled ? "true" : "false");

        await client.query(
            `SELECT public.user_sync($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
                entrauserids,   entratenantids, usernames,    jobtitles,
                businessphones, useremails,     departments,  mobilephones,
                createddates,   tenantnames,    tenantemails, userroles,
                statuses,
            ]
        );

        console.log(`[SYNC] Batch upserted ${validUsers.length} users`);

        const managerPairs = await fetchManagersBatch(graphUsers, headers);

        let managersResolved = 0;
        let managersFailed   = 0;

        if (managerPairs.length > 0) {
            try {
                await client.query(
                    `SELECT public.user_batch_sync_managers($1, $2)`,
                    [
                        managerPairs.map(p => p.userEntraId),
                        managerPairs.map(p => p.managerEntraId),
                    ]
                );
                managersResolved = managerPairs.length;
                console.log(`[SYNC] Batch synced ${managersResolved} managers`);
            } catch (err) {
                console.error("[SYNC] Batch manager sync failed:", err.message);
                managersFailed = managerPairs.length;
            }
        }

        return res.status(200).json({
            message:          "Sync completed.",
            total:            graphUsers.length,
            synced:           validUsers.length,
            skipped:          graphUsers.length - validUsers.length,
            managersResolved,
            managersFailed,
        });

    } catch (err) {
        console.error("[SYNC] sync_Users error:", err.message);

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
        const token   = await getAccessToken(tenant.v_entratenantid); // yours, their tenantId
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

        const existingResult = await client.query(
          "SELECT * FROM public.user_email_get()"
        );
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

const create_user_onlogin = async (req, res) => {
  try {

    const entraUserId = req.user?.oid || req.user?.sub;
    const tenantId    = req.user?.tid;
    const displayName = req.user?.name                ?? null;
    const email       = req.user?.preferred_username  ?? req.user?.email ?? null;
    const roles       = req.user?.roles               ?? [];
    const userRole    = roles.length > 0 ? roles[0] : "User";

    if (!entraUserId || !tenantId) {
      return res.status(400).json({ error: "Invalid token: missing user or tenant ID" });
    }

    const existingUser = await client.query(
      `SELECT * FROM public.user_get_info($1)`,
      [entraUserId]
    );

    const existingRow = existingUser.rows[0];
    if (existingRow?.v_entrauserid) {
      return res.status(200).json({
        message: "User already exists",
        user: existingRow,
      });
    }

    const tenantCheck = await client.query(
      `SELECT * FROM public.tenant_get() WHERE v_entratenantid = $1`,
      [tenantId]
    );

    if (tenantCheck.rows.length === 0) {
      return res.status(403).json({
        error: "Access denied: your organization is not registered in this system.",
      });
    }

    const tenant = tenantCheck.rows[0];

    await client.query(
      `SELECT public.user_create_onlogin($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        entraUserId,          // $1  user entra id
        tenantId,             // $2  tenant entra id
        displayName,          // $3  display name from token
        null,                 // $4  jobTitle — not in token, skip for now
        null,                 // $5  businessPhone — not in token, skip for now
        email,                // $6  email from token
        null,                 // $7  department — not in token, skip for now
        null,                 // $8  mobilePhone — not in token, skip for now
        new Date().toISOString(), // $9 createdDateTime
        tenant.v_tenantname,  // $10 tenant name from DB
        tenant.v_tenantemail, // $11 tenant email from DB
        userRole,             // $12 role from token claims
        "true",               // $13 accountEnabled — if they can log in, they're enabled
      ]
    );

    const newUser = await client.query(
      `SELECT * FROM public.user_get_info($1)`,
      [entraUserId]
    );

    return res.status(200).json({
      message: "User created on login",
      user: newUser.rows[0],
    });

  } catch (err) {
    console.error("[LOGIN SYNC ERROR]:", err.message);
    if (err.response) return res.status(err.response.status).json({ error: err.response.data?.error?.message });
    if (err.request)  return res.status(504).json({ error: "No response from Microsoft Graph" });
    return res.status(500).json({ error: "Internal Server Error" });
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
  get_UserFromDb,
  get_User_Info,
  update_UserRole,
  sync_Users,
  sync_AllTenantUsers,
  create_user_onlogin
};