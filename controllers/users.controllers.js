const axios = require('axios');
const { getAccessToken } = require('../config/authService');
const { resolveRoleName } = require('../config/groupRoleMap');
const client = require("../config/db");
const { getDynamicsToken } = require('../utils/dynamicsToken');

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

const get_User_Role = async (req, res) => {
  try {
    const { entrauserid } = req.query;

    if (!entrauserid) {
      return res.status(400).json({ error: "entrauserid is required" });
    }

    const result = await client.query(
      `SELECT * FROM public.user_get_role($1)`,
      [entrauserid]
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("get_User_Role error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const update_UserRole = async (req, res) => {
  try {
    const { entrauserid, userrole, modifiedby } = req.body;
    //Will remove this if it fails -jasper
    if (!entrauserid) {
      return res.status(400).json({ error: "entrauserid is required" });
    }
    //
    const result = await client.query(
      "SELECT public.user_update_role($1, $2, $3)",
      [entrauserid, userrole, modifiedby]
    );

    const useruuid = result.rows[0]?.user_update_role || null;
    // Emit real-time notification to the user about their role change (will remove this if it fails -jasper)
    const io = req.app?.get("io");
    if (io) {
      io.to(entrauserid).emit("user:role_changed", {
        entrauserid,
        userrole,
        updatedBy: modifiedby ?? null,
        countdownSeconds: 10,
      });
    }
    //
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

          try {
            const dynamicsToken = await getDynamicsToken();
            const accountRes = await axios.get(
                `${process.env.DYNAMICS_URL}/api/data/v9.2/accounts?$filter=ss_azuretenantid eq '${entraTenantId}'&$select=accountid,name&$top=1`,
                {
                    headers: {
                        Authorization:      `Bearer ${dynamicsToken}`,
                        Accept:             "application/json",
                        "OData-Version":    "4.0",
                        "OData-MaxVersion": "4.0",
                    }
                }
            );

            const dynamicsAccount = accountRes.data.value?.[0] ?? null;

            if (dynamicsAccount?.accountid) {
                await client.query(
                    `SELECT * FROM tenant_update_dynamicsaccountid($1, $2)`,
                    [dynamicsAccount.accountid, entraTenantId]
                );
                console.log(`[SYNC] Linked Dynamics accountid ${dynamicsAccount.accountid} to tenant ${entraTenantId}`);
            } else {
                console.warn(`[SYNC] No Dynamics account found for tenant: ${entraTenantId}`);
            }
        } catch (dynamicsErr) {
            console.warn(`[SYNC] Could not fetch Dynamics accountid:`, dynamicsErr.message);
          
        }

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


const create_user_onlogin = async (req, res) => {
  try {
    const entraUserId = req.user?.oid || req.user?.sub;
    const tenantId    = req.user?.tid;
    const displayName = req.user?.name               ?? null;
    const email       = req.user?.preferred_username ?? req.user?.email ?? null;
    const roles       = req.user?.roles              ?? [];
    const userRole    = roles.length > 0 ? roles[0] : "User";

    if (!entraUserId || !tenantId) {
      return res.status(400).json({ error: "Invalid token: missing user or tenant ID" });
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

    const existingUser = await client.query(
      `SELECT * FROM public.user_get_info($1)`,
      [entraUserId]
    );

    const existingRow = existingUser.rows[0];
    if (existingRow?.entrauserid) {
      return res.status(200).json({
        message: "User already exists",
        user: existingRow,
      });
    }

    await client.query(
      `SELECT public.user_create_onlogin($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        entraUserId,        
        tenantId,           
        displayName,        
        null,               
        null,              
        email,              
        null,               
        null,               
        new Date().toISOString(), 
        tenant.v_tenantname,     
        tenant.v_tenantemail,   
        userRole,          
        "true",            
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

const create_Group = async (req, res) => {
  try {
    const {
      tenantId,          // optional — falls back to JWT if not provided
      displayName,
      mailNickname,
      mailEnabled = false,
      securityEnabled = true,
      groupTypes = [],
      description,
      ownerOids = [],
      memberOids = [],
    } = req.body || {};

    const resolvedTenantId = tenantId || req.tenantId; // ← body first, JWT fallback

    if (!resolvedTenantId) {
      return res.status(400).json({ error: "tenantId could not be resolved" });
    }

    if (!displayName || !mailNickname) {
      return res.status(400).json({ error: "displayName and mailNickname are required" });
    }

    const token = await getAccessToken(resolvedTenantId);

    const payload = {
      displayName,
      mailNickname,
      mailEnabled,
      securityEnabled,
      groupTypes,
      ...(description && { description }),
      ...(ownerOids.length && {
        "owners@odata.bind": ownerOids.map((oid) => `${GRAPH_URL}/users/${oid}`),
      }),
      ...(memberOids.length && {
        "members@odata.bind": memberOids.map((oid) => `${GRAPH_URL}/users/${oid}`),
      }),
    };

    const response = await axios.post(`${GRAPH_URL}/groups`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    return res.status(201).json(response.data);
  } catch (err) {
    console.error("create_Group error:", err.message);

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
  get_User_Role,
  update_UserRole,
  sync_Users,
  create_user_onlogin,
  create_Group,
};