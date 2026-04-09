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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Step 1: Acquire Token ────────────────────────────────────────────────────

const step1_acquireToken = async (tenant) => {
  console.log(`[STEP 1] Acquiring token for consenting tenant=${tenant}...`);
  const token = await getAccessToken(tenant);
  console.log("[STEP 1] ✅ Token acquired");
  return token;
};

// ─── Step 2: Fetch Org Info + Dynamics in Parallel ───────────────────────────
// Both are independent — run together to save time.
// Both non-fatal: failures log a warning and return nulls.

const step2_fetchOrgAndDynamics = async (token, tenant) => {
  console.log("[STEP 2] Fetching org info (Graph) + Dynamics accountid in parallel...");
  const headers = makeHeaders(token);

  const [orgResult, dynamicsResult] = await Promise.allSettled([
    axios.get(`${GRAPH_URL}/organization`, {
      headers,
      params: { $select: "id,displayName,verifiedDomains,technicalNotificationMails" },
      timeout: 10000,
    }),
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

  let tenantName = null, tenantDomain = null, tenantEmail = null;
  if (orgResult.status === "fulfilled") {
    const org  = orgResult.value.data.value?.[0];
    tenantName   = org?.displayName ?? null;
    tenantDomain = org?.verifiedDomains?.find((d) => d.isDefault)?.name ?? null;
    tenantEmail  = org?.technicalNotificationMails?.[0] ?? null;
    console.log(`[STEP 2] ✅ Graph — org=${tenantName} | domain=${tenantDomain} | email=${tenantEmail}`);
  } else {
    console.warn(`[STEP 2] ⚠️ Graph org fetch failed (non-fatal): ${orgResult.reason?.message}`);
  }

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
  const rolesToGrant = REQUIRED_GRAPH_ROLES.filter((id) => !existingRoleIds.has(id));

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
    console.warn("[STEP 3] Permission grant failed:", f.reason?.response?.data?.error?.message ?? f.reason?.message),
  );
  console.log(`[STEP 3] ✅ Graph permissions — granted: ${granted}, already existed: ${skipped}, failed: ${failed.length}`);
};

// ─── Step 4: Update Tenant in DB ─────────────────────────────────────────────
// Single atomic tenant_update: sets isconsented=true + patches real org info.
// Returns tenantuuid — no second round-trip needed.

const step4_updateTenantRecord = async (tenant, tenantName, tenantEmail, dynamicsAccountId) => {
  console.log("[STEP 4] Fetching current tenant row for full update...");

  const currentRes = await client.query(
    `SELECT * FROM public.tenant_get_map_with_entratenantid() WHERE entratenantid = $1`,
    [tenant],
  );
  const current = currentRes.rows[0];
  if (!current) throw new Error(`Tenant not found in DB — tenant=${tenant}`);

  console.log(`[STEP 4] Current row — tenantuuid=${current.tenantuuid} | name=${current.tenantname}`);

  await client.query(
    `SELECT public.tenant_update($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      current.tenantuuid,
      tenant,
      tenantName        ?? current.tenantname,
      tenantEmail       ?? current.tenantemail,
      dynamicsAccountId ?? current.dynamicsaccountid,
      current.admingroupid,                            // preserved — flow6 will update
      current.usergroupid,                             // preserved — flow6 will update
      current.isactive  ?? true,
      true,                                            // isconsented = true
      current.isapproved ?? false,
    ],
  );

  console.log(`[STEP 4] ✅ Tenant updated — isconsented=true | name=${tenantName ?? current.tenantname}`);
  return current.tenantuuid;
};

// ─── Flow 1: Resolve Enterprise SP in Consenting Tenant ──────────────────────

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
// The consenting admin MUST end up in PowerIntake.Admin (not just PowerIntake.Users).
//
// WHY sequential + retry:
//   Groups are freshly created in Flow 2. Azure AD replication takes a few seconds.
//   Running both adds in parallel with Promise.allSettled can cause the admin-group
//   add to fail silently if the group isn't fully replicated yet.
//   We add to adminGroup FIRST and confirm it before adding to usersGroup,
//   with a short retry loop to handle replication lag.

const flow3_assignAdminToGroups = async (headers, adminOid, adminGroupId, usersGroupId) => {
  console.log(`[FLOW 3] Assigning admin ${adminOid} to both groups (sequential, admin group first)...`);

  const addToGroupWithRetry = async (groupId, label, maxAttempts = 4, delayMs = 3000) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check membership first — use ConsistencyLevel for freshly created groups
        const checkRes = await axios.get(
          `${GRAPH_URL}/groups/${groupId}/members?$select=id`,
          {
            headers: { ...headers, "ConsistencyLevel": "eventual" },
            params: { $filter: `id eq '${adminOid}'`, $count: true },
            timeout: 10000,
          },
        );
        if (checkRes.data.value?.length > 0) {
          console.log(`[FLOW 3] Admin already a member of ${label} (${groupId})`);
          return true;
        }
      } catch (checkErr) {
        console.warn(`[FLOW 3] Membership check skipped for ${label} (attempt ${attempt}): ${checkErr.message}`);
      }

      try {
        await axios.post(
          `${GRAPH_URL}/groups/${groupId}/members/$ref`,
          { "@odata.id": `${GRAPH_URL}/directoryObjects/${adminOid}` },
          { headers, timeout: 10000 },
        );
        console.log(`[FLOW 3] ✅ Added admin to ${label} (${groupId}) on attempt ${attempt}`);
        return true;
      } catch (err) {
        const msg    = err.response?.data?.error?.message ?? err.message;
        const status = err.response?.status;

        if (status === 400 && msg?.toLowerCase().includes("already exist")) {
          console.log(`[FLOW 3] Admin already in ${label} — conflict ignored`);
          return true;
        }

        if (status === 404 && attempt < maxAttempts) {
          console.warn(`[FLOW 3] ${label} not found yet (replication lag), retrying in ${delayMs}ms... (attempt ${attempt}/${maxAttempts})`);
          await sleep(delayMs);
          continue;
        }

        console.warn(`[FLOW 3] Failed to add admin to ${label} (attempt ${attempt}): ${msg}`);
        if (attempt === maxAttempts) return false;
        await sleep(delayMs);
      }
    }
    return false;
  };

  // Admin group FIRST — this is the critical one
  const adminAdded = await addToGroupWithRetry(adminGroupId, "PowerIntake.Admin");
  if (!adminAdded) {
    console.error(`[FLOW 3] ❌ Could not add admin to PowerIntake.Admin after all retries`);
  }

  // Users group SECOND — after admin group is confirmed
  const usersAdded = await addToGroupWithRetry(usersGroupId, "PowerIntake.Users");
  if (!usersAdded) {
    console.warn(`[FLOW 3] ⚠️ Could not add admin to PowerIntake.Users after all retries`);
  }

  console.log(`[FLOW 3] ✅ Admin assignment complete — admin: ${adminAdded}, users: ${usersAdded}`);
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
      const advancedUrl     = `${GRAPH_URL}/users?$filter=accountEnabled eq true&$select=id&$top=999&$count=true`;

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

    // Strategy 3: No $filter — maximum compatibility
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
        { "members@odata.bind": chunk.map((u) => `${GRAPH_URL}/directoryObjects/${u.id}`) },
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

// ─── Provisioning Orchestrator ────────────────────────────────────────────────
// All flows run sequentially and are all required — no flow is skipped.
// This is now awaited in consent_Callback before the response is sent,
// so the browser waits until ALL provisioning is complete.
//
// Flow order matters:
//   Flow 1: SP must be resolved before Flow 5 can assign app roles
//   Flow 2: Groups must exist before Flow 3 (admin assign) and Flow 4 (user assign)
//   Flow 3: Admin added to groups — sequential, admin group first (replication safety)
//   Flow 4: All tenant users added to PowerIntake.Users
//   Flow 5: Groups assigned to app roles on the enterprise SP
//   Flow 6: Group IDs written to DB — must be last, confirms everything succeeded

const runPostConsentFlow = async ({ token, tenant, adminOid, tenantUuid }) => {
  console.log("[POST-CONSENT] ── Starting provisioning (blocking) ───────────");
  const headers = makeHeaders(token);

  // Flow 1 — Resolve enterprise SP (required by Flow 5)
  const enterpriseSp = await flow1_resolveEnterpriseSp(headers);

  // Flow 2 — Ensure both groups exist (required by Flows 3, 4, 5)
  const { adminGroupId, usersGroupId } = await flow2_ensureGroups(headers);

  // Flow 3 — Add consenting admin to PowerIntake.Admin AND PowerIntake.Users
  // Sequential with retry — admin group first, replication-safe
  await flow3_assignAdminToGroups(headers, adminOid, adminGroupId, usersGroupId);

  // Flow 4 — Batch assign all active tenant users to PowerIntake.Users
  await flow4_batchAssignUsersToGroup(headers, usersGroupId);

  // Flow 5 — Assign groups to their app roles on the tenant's enterprise SP
  await flow5_assignGroupsToAppRoles(headers, adminGroupId, usersGroupId, enterpriseSp.id);

  // Flow 6 — Persist group IDs to DB (confirms full provisioning in DB)
  if (tenantUuid) {
    await flow6_persistGroupIdsToDb(tenantUuid, adminGroupId, usersGroupId);
  } else {
    console.warn("[POST-CONSENT] ⚠️ Skipping Flow 6 — tenantUuid is null");
  }

  console.log("[POST-CONSENT] ✅ Full provisioning flow completed successfully");
};

// ─── Consent Callback (Main Entry Point) ─────────────────────────────────────
// Called by /ms-consent-callback after the admin approves on Microsoft's
// adminconsent page. The enterprise app SP now exists in the tenant.
//
// IMPORTANT: runPostConsentFlow is AWAITED — the response is NOT sent until
// all provisioning is complete. This ensures:
//   - The admin is in PowerIntake.Admin before the browser redirects
//   - Group IDs are in DB before the user can reach /home
//   - No partial state if the user refreshes immediately after consent

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
    // Step 1 — Acquire app-only token (client_credentials, valid post-consent)
    const token   = await step1_acquireToken(tenant);
    const headers = makeHeaders(token);

    // Step 2 — Graph org info + Dynamics in parallel (both non-fatal)
    const { tenantName, tenantEmail, dynamicsAccountId } =
      await step2_fetchOrgAndDynamics(token, tenant);

    // Step 3 — Auto-grant Graph app permissions (non-fatal)
    try {
      await step3_grantGraphPermissions(token);
    } catch (grantErr) {
      console.warn("[CONSENT] Step 3 ⚠️ Could not auto-grant Graph permissions:", grantErr.message);
    }

    // Step 4 — Single atomic DB update: isconsented=true + real org info
    // Returns tenantuuid — no extra round-trip needed
    const tenantUuid = await step4_updateTenantRecord(tenant, tenantName, tenantEmail, dynamicsAccountId);

    // Steps 1–4 are complete. Now run ALL provisioning flows and WAIT for them.
    // The response is held until everything is done — the browser shows the
    // /ms-consent-callback loading screen during this time.
    // This guarantees the admin is in PowerIntake.Admin and group IDs are in DB
    // before the user is redirected to /home.
    console.log("[CONSENT] Running provisioning flows (blocking until complete)...");
    await runPostConsentFlow({ token, tenant, adminOid, tenantUuid });

    // All done — now respond
    console.log("[CONSENT] ✅ All provisioning complete — responding with consent=success");
    return res.json({ redirectUrl: "/consent-callback?consent=success" });

  } catch (err) {
    console.error("[CONSENT] ❌ Unhandled exception:", err.message);
    console.error(err.stack);
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }
};

module.exports = { consent_Callback };