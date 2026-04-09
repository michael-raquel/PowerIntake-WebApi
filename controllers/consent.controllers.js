const axios = require("axios");
const client = require("../config/db");
const { getAccessToken } = require("../config/authService");
const { getDynamicsToken } = require("../utils/dynamicsToken");

const GRAPH_URL    = "https://graph.microsoft.com/v1.0";
const GRAPH_APP_ID = "00000003-0000-0000-c000-000000000000";

const REQUIRED_GRAPH_ROLES = [
  "62a82d76-70ea-41e2-9197-370581804d09", // Group.ReadWrite.All
  "dbaae8cf-10b5-4b86-a4a1-f871c94c6695", // GroupMember.ReadWrite.All
  "df021288-bdef-4463-88db-98f22de89214", // User.Read.All
  "5b567255-7703-4780-807c-7be8301ae99b", // Group.Read.All
];

const ADMIN_APP_ROLE_ID = "3d316243-5776-4d70-93e0-0762378f97ed"; // PowerIntake.Admin
const USERS_APP_ROLE_ID = "154626a2-3572-4da2-9b85-050ff2f833d8"; // PowerIntake.Users

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

// ─── Step 1: Acquire Token ────────────────────────────────────────────────────
// Uses client_credentials (app-only) flow. Only works AFTER the admin has
// completed consent — the enterprise SP must exist in the tenant.

const step1_acquireToken = async (tenant) => {
  console.log(`[STEP 1] Acquiring token for consenting tenant=${tenant}...`);
  const token = await getAccessToken(tenant);
  console.log("[STEP 1] ✅ Token acquired");
  return token;
};

// ─── Step 2: Fetch Org Info + Dynamics in Parallel ───────────────────────────
// Both calls are independent — run them together to save time.
// Both are non-fatal: if either fails we log a warning and continue with nulls.

const step2_fetchOrgAndDynamics = async (token, tenant) => {
  console.log("[STEP 2] Fetching org info (Graph) + Dynamics accountid in parallel...");
  const headers = makeHeaders(token);

  const [orgResult, dynamicsResult] = await Promise.allSettled([
    // Graph: get real org display name, email, verified domains
    axios.get(`${GRAPH_URL}/organization`, {
      headers,
      params: {
        $select: "id,displayName,verifiedDomains,technicalNotificationMails",
      },
      timeout: 10000,
    }),

    // Dynamics: resolve the CRM account linked to this Azure tenant
    (async () => {
      const dynamicsToken = await getDynamicsToken();
      return axios.get(
        `${process.env.DYNAMICS_URL}/api/data/v9.2/accounts?$filter=ss_azuretenantid eq '${tenant}'&$select=accountid&$top=1`,
        {
          headers: {
            Authorization:      `Bearer ${dynamicsToken}`,
            Accept:             "application/json",
            "OData-Version":    "4.0",
            "OData-MaxVersion": "4.0",
          },
          timeout: 10000,
        },
      );
    })(),
  ]);

  // Graph result
  let tenantName         = null;
  let tenantDomain       = null;
  let tenantEmail        = null;
  if (orgResult.status === "fulfilled") {
    const org    = orgResult.value.data.value?.[0];
    tenantName   = org?.displayName ?? null;
    tenantDomain = org?.verifiedDomains?.find((d) => d.isDefault)?.name ?? null;
    tenantEmail  = org?.technicalNotificationMails?.[0] ?? null;
    console.log(`[STEP 2] ✅ Graph — org=${tenantName} | domain=${tenantDomain} | email=${tenantEmail}`);
  } else {
    console.warn(`[STEP 2] ⚠️ Graph org fetch failed (non-fatal): ${orgResult.reason?.message}`);
  }

  // Dynamics result
  let dynamicsAccountId = null;
  if (dynamicsResult.status === "fulfilled") {
    dynamicsAccountId = dynamicsResult.value.data.value?.[0]?.accountid ?? null;
    console.log(`[STEP 2] ✅ Dynamics — dynamicsAccountId=${dynamicsAccountId ?? "not found"}`);
  } else {
    console.warn(`[STEP 2] ⚠️ Dynamics lookup failed (non-fatal): ${dynamicsResult.reason?.message}`);
  }

  return { tenantName, tenantDomain, tenantEmail, dynamicsAccountId };
};

// ─── Step 3: Grant Graph App Permissions ─────────────────────────────────────

const step3_grantGraphPermissions = async (token) => {
  console.log("[STEP 3] Granting Graph permissions...");
  const headers = makeHeaders(token);

  const ourSpRes = await axios.get(
    `${GRAPH_URL}/servicePrincipals?$filter=appId eq '${process.env.AZURE_CLIENT_ID}'&$select=id,appId,displayName`,
    { headers },
  );
  const ourSp = ourSpRes.data.value?.[0];
  if (!ourSp) throw new Error("Our service principal not found on client tenant");

  const graphSpRes = await axios.get(
    `${GRAPH_URL}/servicePrincipals?$filter=appId eq '${GRAPH_APP_ID}'&$select=id,appRoles`,
    { headers },
  );
  const graphSp = graphSpRes.data.value?.[0];
  if (!graphSp) throw new Error("Microsoft Graph service principal not found");

  const existingRes = await axios.get(
    `${GRAPH_URL}/servicePrincipals/${ourSp.id}/appRoleAssignments`,
    { headers },
  );
  const existingRoleIds = new Set(existingRes.data.value.map((a) => a.appRoleId));

  const rolesToGrant = REQUIRED_GRAPH_ROLES.filter((roleId) => !existingRoleIds.has(roleId));

  const results = await Promise.allSettled(
    rolesToGrant.map((appRoleId) =>
      axios.post(
        `${GRAPH_URL}/servicePrincipals/${ourSp.id}/appRoleAssignments`,
        { principalId: ourSp.id, resourceId: graphSp.id, appRoleId },
        { headers },
      ),
    ),
  );

  const granted = results.filter((r) => r.status === "fulfilled").length;
  const skipped = existingRoleIds.size;
  const failed  = results.filter((r) => r.status === "rejected");

  failed.forEach((f) =>
    console.warn(
      "[STEP 3] Permission grant failed:",
      f.reason?.response?.data?.error?.message ?? f.reason?.message,
    ),
  );

  console.log(
    `[STEP 3] ✅ Graph permissions — granted: ${granted}, already existed: ${skipped}, failed: ${failed.length}`,
  );
};

// ─── Step 4: Update Tenant in DB ──────────────────────────────────────────────
// Fetches the current tenant row, merges with real Graph/Dynamics data,
// sets isconsented=true, and calls tenant_update in a single atomic operation.
// Replaces both the old step4_updateDbConsentFlag and step4a org patch.

const step4_updateTenantRecord = async (tenant, tenantName, tenantEmail, dynamicsAccountId) => {
  console.log("[STEP 4] Fetching current tenant row for full update...");

  const currentRes = await client.query(
    `SELECT * FROM public.tenant_get_map_with_entratenantid() WHERE entratenantid = $1`,
    [tenant],
  );
  const current = currentRes.rows[0];

  if (!current) {
    throw new Error(`Tenant not found in DB — tenant=${tenant}`);
  }

  console.log(`[STEP 4] Current row — tenantuuid=${current.tenantuuid} | name=${current.tenantname}`);

  // Merge: prefer real Graph data, but ALWAYS fallback to existing DB value to prevent null constraint violations
  const finalTenantName = tenantName || current.tenantname;
  const finalTenantEmail = tenantEmail || current.tenantemail;
  const finalDynamicsAccountId = dynamicsAccountId || current.dynamicsaccountid;

  if (!finalTenantName) {
    throw new Error(`Cannot update tenant — tenantname is null in both Graph and DB for tenant=${tenant}`);
  }

  await client.query(
    `SELECT public.tenant_update($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      current.tenantuuid,
      tenant,
      finalTenantName,
      finalTenantEmail,
      finalDynamicsAccountId,
      current.admingroupid,
      current.usergroupid,
      current.isactive ?? true,
      true,
      current.isapproved ?? false,
    ],
  );

  console.log(
    `[STEP 4] ✅ Tenant updated — isconsented=true | name=${finalTenantName} | email=${finalTenantEmail}`,
  );

  return current.tenantuuid;
};

// ─── Flow 1: Resolve Enterprise SP in Consenting Tenant ──────────────────────
// CRITICAL for multi-tenant: each tenant gets its own SP object ID even though
// the appId (clientId) is the same everywhere. resourceId in appRoleAssignments
// must target the consenting tenant's SP, not the home tenant's.

const flow1_resolveEnterpriseSp = async (headers) => {
  console.log("[FLOW 1] Resolving enterprise app SP in consenting tenant...");

  const spRes = await axios.get(
    `${GRAPH_URL}/servicePrincipals?$filter=appId eq '${process.env.AZURE_CLIENT_ID}'&$select=id,appId,displayName`,
    { headers, timeout: 10000 },
  );
  const sp = spRes.data.value?.[0];

  if (!sp) {
    throw new Error(
      `[FLOW 1] Enterprise app SP not found in consenting tenant for appId=${process.env.AZURE_CLIENT_ID}. ` +
        `Ensure the tenant has completed admin consent.`,
    );
  }

  console.log(`[FLOW 1] ✅ Resolved enterprise SP — id=${sp.id}, displayName=${sp.displayName}`);
  return sp;
};

// ─── Flow 2: Ensure Groups Exist ─────────────────────────────────────────────

const flow2_ensureGroups = async (headers) => {
  console.log("[FLOW 2] Ensuring PowerIntake groups exist...");

  const findGroup = async (displayName) => {
    const res = await axios.get(
      `${GRAPH_URL}/groups?$filter=displayName eq '${displayName}'&$select=id,displayName`,
      { headers, timeout: 10000 },
    );
    return res.data.value?.[0] ?? null;
  };

  const createGroup = async (displayName) => {
    const res = await axios.post(
      `${GRAPH_URL}/groups`,
      {
        displayName,
        mailNickname:    displayName.replace(/\./g, ""),
        mailEnabled:     false,
        securityEnabled: true,
        groupTypes:      [],
      },
      { headers, timeout: 10000 },
    );
    console.log(`[FLOW 2] Created group: ${displayName} → ${res.data.id}`);
    return res.data;
  };

  let adminGroup = await findGroup("PowerIntake.Admin");
  if (adminGroup) {
    console.log(`[FLOW 2] Group already exists: PowerIntake.Admin → ${adminGroup.id}`);
  } else {
    adminGroup = await createGroup("PowerIntake.Admin");
  }

  let usersGroup = await findGroup("PowerIntake.Users");
  if (usersGroup) {
    console.log(`[FLOW 2] Group already exists: PowerIntake.Users → ${usersGroup.id}`);
  } else {
    usersGroup = await createGroup("PowerIntake.Users");
  }

  console.log("[FLOW 2] ✅ Groups ensured");
  return { adminGroupId: adminGroup.id, usersGroupId: usersGroup.id };
};

// ─── Flow 3: Assign Global Admin to Both Groups ───────────────────────────────

const flow3_assignAdminToGroups = async (headers, adminOid, adminGroupId, usersGroupId) => {
  console.log(`[FLOW 3] Assigning admin ${adminOid} to both groups...`);

  const addToGroup = async (groupId) => {
    try {
      const checkRes = await axios.get(
        `${GRAPH_URL}/groups/${groupId}/members?$filter=id eq '${adminOid}'&$select=id`,
        { headers, timeout: 10000 },
      );
      if (checkRes.data.value?.length > 0) {
        console.log(`[FLOW 3] Admin already a member of group ${groupId}`);
        return;
      }
    } catch (e) {
      console.warn(`[FLOW 3] Member check skipped for group ${groupId}, attempting add:`, e.message);
    }

    try {
      await axios.post(
        `${GRAPH_URL}/groups/${groupId}/members/$ref`,
        { "@odata.id": `${GRAPH_URL}/directoryObjects/${adminOid}` },
        { headers, timeout: 10000 },
      );
      console.log(`[FLOW 3] Added admin ${adminOid} to group ${groupId}`);
    } catch (err) {
      const msg = err.response?.data?.error?.message ?? err.message;
      if (err.response?.status === 400 && msg?.toLowerCase().includes("already exist")) {
        console.log(`[FLOW 3] Admin already in group ${groupId} (conflict ignored)`);
      } else {
        console.warn(`[FLOW 3] Failed to add admin to group ${groupId}:`, msg);
      }
    }
  };

  await Promise.allSettled([addToGroup(adminGroupId), addToGroup(usersGroupId)]);
  console.log("[FLOW 3] ✅ Admin assignment complete");
};

// ─── Flow 4: Batch Assign Active Tenant Users to PowerIntake.Users ────────────
// Strategy 1: Standard $filter (works on most tenants)
// Strategy 2: Advanced query mode with ConsistencyLevel: eventual (strict tenants)
// Strategy 3: Unfiltered fallback — assigns all users regardless of account state

const flow4_batchAssignUsersToGroup = async (headers, usersGroupId) => {
  console.log("[FLOW 4] Batch assigning active tenant users to PowerIntake.Users...");

  const fetchActiveUsers = async () => {
    const simpleUrl = `${GRAPH_URL}/users?$filter=accountEnabled eq true&$select=id&$top=999`;

    try {
      console.log("[FLOW 4] Strategy 1 — Fetching active users (standard query)...");
      let users = [];
      let nextLink = simpleUrl;
      while (nextLink) {
        const { data } = await axios.get(nextLink, { headers, timeout: 15000 });
        users.push(...data.value);
        nextLink = data["@odata.nextLink"] ?? null;
      }
      console.log(`[FLOW 4] Strategy 1 ✅ Fetched ${users.length} active users`);
      return { users, filtered: true };
    } catch (err) {
      const errCode = err.response?.data?.error?.code ?? "";
      const errMsg  = err.response?.data?.error?.message ?? err.message;
      const isQueryUnsupported =
        err.response?.status === 400 &&
        (errCode === "Request_UnsupportedQuery" || errMsg.includes("ConsistencyLevel"));

      if (!isQueryUnsupported) throw err;
      console.warn(`[FLOW 4] Strategy 1 ⚠️ Unsupported on this tenant (${errCode}), trying Strategy 2...`);
    }

    try {
      console.log("[FLOW 4] Strategy 2 — Fetching active users (advanced query mode)...");
      const advancedHeaders = { ...headers, "ConsistencyLevel": "eventual" };
      const advancedUrl = `${GRAPH_URL}/users?$filter=accountEnabled eq true&$select=id&$top=999&$count=true`;

      let users = [];
      let nextLink = advancedUrl;
      while (nextLink) {
        const { data } = await axios.get(nextLink, { headers: advancedHeaders, timeout: 15000 });
        users.push(...data.value);
        nextLink = data["@odata.nextLink"] ?? null;
      }
      console.log(`[FLOW 4] Strategy 2 ✅ Fetched ${users.length} active users`);
      return { users, filtered: true };
    } catch (err) {
      console.warn(`[FLOW 4] Strategy 2 ⚠️ Advanced query also failed: ${err.response?.data?.error?.message ?? err.message}`);
      console.warn("[FLOW 4] Strategy 3 — Falling back to fetching all users unfiltered...");
    }

    // Strategy 3: No $filter — maximum compatibility, includes disabled accounts
    const fallbackUrl = `${GRAPH_URL}/users?$select=id&$top=999`;
    let users = [];
    let nextLink = fallbackUrl;
    while (nextLink) {
      const { data } = await axios.get(nextLink, { headers, timeout: 15000 });
      users.push(...data.value);
      nextLink = data["@odata.nextLink"] ?? null;
    }
    console.log(`[FLOW 4] Strategy 3 ✅ Fetched ${users.length} users (unfiltered — includes disabled accounts)`);
    return { users, filtered: false };
  };

  const { users: allUsers, filtered } = await fetchActiveUsers();

  if (!filtered) {
    console.warn("[FLOW 4] ⚠️ Could not filter by accountEnabled — disabled accounts may be included");
  }

  if (allUsers.length === 0) {
    console.log("[FLOW 4] No users found in tenant for group assignment");
    return;
  }

  const existingMemberIds = new Set();
  let membersLink = `${GRAPH_URL}/groups/${usersGroupId}/members?$select=id&$top=999`;
  while (membersLink) {
    const { data } = await axios.get(membersLink, { headers, timeout: 15000 });
    data.value.forEach((m) => existingMemberIds.add(m.id));
    membersLink = data["@odata.nextLink"] ?? null;
  }

  const usersToAdd = allUsers.filter((u) => !existingMemberIds.has(u.id));

  if (usersToAdd.length === 0) {
    console.log(`[FLOW 4] All ${allUsers.length} users already in PowerIntake.Users`);
    return;
  }

  console.log(`[FLOW 4] Adding ${usersToAdd.length} users (${existingMemberIds.size} already members)...`);

  const chunkSize = 20;
  for (let i = 0; i < usersToAdd.length; i += chunkSize) {
    const chunk    = usersToAdd.slice(i, i + chunkSize);
    const rangeEnd = Math.min(i + chunkSize, usersToAdd.length);

    try {
      await axios.patch(
        `${GRAPH_URL}/groups/${usersGroupId}`,
        {
          "members@odata.bind": chunk.map((u) => `${GRAPH_URL}/directoryObjects/${u.id}`),
        },
        { headers, timeout: 15000 },
      );
      console.log(`[FLOW 4] Users chunk added: ${i + 1}–${rangeEnd} of ${usersToAdd.length}`);
    } catch (err) {
      console.warn(`[FLOW 4] Chunk ${i} failed:`, err.response?.data?.error?.message ?? err.message);
    }
  }

  console.log("[FLOW 4] ✅ Batch user assignment complete");
};

// ─── Flow 5: Assign Groups to App Roles on Tenant's Enterprise SP ─────────────
// KEY: enterpriseSpId is the SP object ID in the CONSENTING tenant.
// In multi-tenant apps, each tenant's enterprise app gets its own object ID
// even though appId is the same everywhere.

const flow5_assignGroupsToAppRoles = async (headers, adminGroupId, usersGroupId, enterpriseSpId) => {
  console.log(`[FLOW 5] Assigning groups to app roles on enterprise SP ${enterpriseSpId}...`);

  const assignGroupRole = async (groupId, appRoleId, label) => {
    const existingRes = await axios.get(
      `${GRAPH_URL}/groups/${groupId}/appRoleAssignments`,
      { headers, timeout: 10000 },
    );
    const alreadyAssigned = existingRes.data.value?.some(
      (a) => a.resourceId === enterpriseSpId && a.appRoleId === appRoleId,
    );

    if (alreadyAssigned) {
      console.log(`[FLOW 5] ${label} already assigned to appRole ${appRoleId} on SP ${enterpriseSpId}`);
      return;
    }

    await axios.post(
      `${GRAPH_URL}/groups/${groupId}/appRoleAssignments`,
      { principalId: groupId, resourceId: enterpriseSpId, appRoleId },
      { headers, timeout: 10000 },
    );
    console.log(`[FLOW 5] Assigned ${label} → appRole ${appRoleId} on SP ${enterpriseSpId}`);
  };

  await Promise.allSettled([
    assignGroupRole(adminGroupId, ADMIN_APP_ROLE_ID, "PowerIntake.Admin"),
    assignGroupRole(usersGroupId, USERS_APP_ROLE_ID, "PowerIntake.Users"),
  ]);

  console.log("[FLOW 5] ✅ App role assignment complete");
};

// ─── Flow 6: Persist Group IDs to DB ─────────────────────────────────────────

const flow6_persistGroupIdsToDb = async (tenantUuid, adminGroupId, usersGroupId) => {
  console.log(`[FLOW 6] Persisting group IDs to DB for tenantUuid=${tenantUuid}...`);

  await client.query(`SELECT public.tenant_update_groups($1, $2, $3)`, [
    tenantUuid,
    adminGroupId,
    usersGroupId,
  ]);

  console.log(`[FLOW 6] ✅ Persisted — adminGroupId: ${adminGroupId}, usersGroupId: ${usersGroupId}`);
};

// ─── Background Provisioning Orchestrator ────────────────────────────────────

const runPostConsentFlow = async ({ token, tenant, adminOid, tenantUuid }) => {
  console.log("[POST-CONSENT] ── Starting background provisioning ────────────");
  const headers = makeHeaders(token);

  try {
    const enterpriseSp = await flow1_resolveEnterpriseSp(headers);
    const { adminGroupId, usersGroupId } = await flow2_ensureGroups(headers);
    await flow3_assignAdminToGroups(headers, adminOid, adminGroupId, usersGroupId);
    await flow4_batchAssignUsersToGroup(headers, usersGroupId);
    await flow5_assignGroupsToAppRoles(headers, adminGroupId, usersGroupId, enterpriseSp.id);

    if (tenantUuid) {
      await flow6_persistGroupIdsToDb(tenantUuid, adminGroupId, usersGroupId);
    } else {
      console.warn("[POST-CONSENT] ⚠️ Skipping Flow 6 — tenantUuid is null");
    }

    console.log("[POST-CONSENT] ✅ Full post-consent flow completed successfully");
  } catch (err) {
    console.error("[POST-CONSENT] ❌ Post-consent flow error:", err.message);
    console.error(err.stack);
  }
};

// ─── Consent Callback (Main Entry Point) ─────────────────────────────────────
// Phase 2 of the consent flow — called by /ms-consent-callback after the admin
// approves on Microsoft's adminconsent page. By this point the enterprise app SP
// exists in the tenant, so getAccessToken(tenant) works and Graph calls succeed.
//
// Sequence:
//   Step 1 — Acquire app-only token (client_credentials, now valid post-consent)
//   Step 2 — Fetch real org info (Graph) + Dynamics accountid IN PARALLEL
//   Step 3 — Grant Graph app permissions (non-fatal)
//   Step 4 — Single tenant_update: sets isconsented=true + patches real org info
//   → Respond immediately with consent=success
//   → Fire-and-forget: run group provisioning in background

const consent_Callback = async (req, res) => {
  const { tenant, admin_consent, error } = req.query;
  const adminOid = req.user?.oid || req.user?.sub;

  console.log("[CONSENT] ── Callback received ──────────────────────────────");
  console.log(`[CONSENT] tenant=${tenant} | admin_consent=${admin_consent} | error=${error ?? "none"}`);
  console.log(`[CONSENT] adminOid=${adminOid ?? "MISSING"}`);

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (error || admin_consent !== "True") {
    console.warn("[CONSENT] ❌ Failed or cancelled by Microsoft");
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }
  if (!tenant) {
    console.error("[CONSENT] ❌ Missing tenant param");
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }
  if (!adminOid) {
    console.error("[CONSENT] ❌ Missing adminOid — validateToken may have failed");
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }

  try {
    // Step 1 — Acquire app-only token for the consenting tenant
    const token   = await step1_acquireToken(tenant);
    const headers = makeHeaders(token);

    // Step 2 — Graph org info + Dynamics in parallel (both non-fatal)
    const { tenantName, tenantDomain, tenantEmail, dynamicsAccountId } =
      await step2_fetchOrgAndDynamics(token, tenant);

    // Step 3 — Auto-grant Graph app permissions (non-fatal)
    try {
      await step3_grantGraphPermissions(token);
    } catch (grantErr) {
      console.warn("[CONSENT] Step 3 ⚠️ Could not auto-grant Graph permissions:", grantErr.message);
    }

    // Step 4 — Single atomic DB update: isconsented=true + real org info from Graph
    // Returns tenantuuid so we don't need a separate round-trip
    const tenantUuid = await step4_updateTenantRecord(tenant, tenantName, tenantEmail, dynamicsAccountId);

    // ── Respond immediately — don't block the browser on background provisioning
    console.log("[CONSENT] ✅ Responding with consent=success — firing background provisioning");
    res.json({ redirectUrl: "/consent-callback?consent=success" });

    // ── Fire-and-forget: groups, user assignment, app role assignment
    // Wait briefly to ensure consent is fully propagated before provisioning
    setTimeout(() => {
      runPostConsentFlow({ token, tenant, adminOid, tenantUuid });
    }, 2000);

  } catch (err) {
    console.error("[CONSENT] ❌ Unhandled exception:", err.message);
    console.error(err.stack);
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }
};

module.exports = { consent_Callback };