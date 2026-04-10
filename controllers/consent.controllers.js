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

// Retry a Graph call with exponential backoff.
// Retries on 404 (directory propagation lag) and 429 (throttling).
const withRetry = async (label, fn, { retries = 5, delayMs = 3000 } = {}) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;
      const isRetryable = status === 404 || status === 429;

      if (!isRetryable || attempt === retries) throw err;

      const wait = delayMs * attempt;
      console.warn(
        `[RETRY] ${label} — attempt ${attempt}/${retries} failed (HTTP ${status}), retrying in ${wait}ms...`,
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
};

// ─── Step 1: Acquire Token ────────────────────────────────────────────────────

const step1_acquireToken = async (tenant) => {
  console.log(`[STEP 1] Acquiring token for consenting tenant=${tenant}...`);
  const token = await getAccessToken(tenant);
  console.log("[STEP 1] ✅ Token acquired");
  return token;
};

// ─── Step 2: Fetch Org Info + Dynamics in Parallel ───────────────────────────
// Fetches displayName and technicalNotificationMails[0] from Graph /organization,
// and the Dynamics accountid in parallel. Both are non-fatal — nulls are returned
// on failure and the DB update falls back to existing values.

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

  // Graph: pull displayName and first technicalNotificationMail
  let tenantName   = null;
  let tenantDomain = null;
  let tenantEmail  = null;
  if (orgResult.status === "fulfilled") {
    const org    = orgResult.value.data.value?.[0];
    tenantName   = org?.displayName ?? null;
    tenantDomain = org?.verifiedDomains?.find((d) => d.isDefault)?.name ?? null;
    tenantEmail  = org?.technicalNotificationMails?.[0] ?? null;
    console.log(`[STEP 2] ✅ Graph — org=${tenantName} | domain=${tenantDomain} | email=${tenantEmail}`);
  } else {
    console.warn(`[STEP 2] ⚠️ Graph org fetch failed (non-fatal): ${orgResult.reason?.message}`);
  }

  // Dynamics: pull accountid
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
  const rolesToGrant    = REQUIRED_GRAPH_ROLES.filter((roleId) => !existingRoleIds.has(roleId));

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

// ─── Step 4: Mark Tenant as Consented ────────────────────────────────────────
// Uses the focused tenant_update_isconsented function to flip the consent flag,
// then resolves the tenantuuid needed by Flow 6's full tenant_update call.

const step4_markTenantConsented = async (tenant) => {
  console.log(`[STEP 4] Marking tenant as consented — entratenantid=${tenant}...`);

  const result = await client.query(
    `SELECT updated, message FROM public.tenant_update_isconsented($1, $2)`,
    [tenant, true],
  );

  const row = result.rows[0];
  console.log(`[STEP 4] ✅ DB response — updated=${row?.updated} | message=${row?.message}`);

  // Fetch the full current row — tenantuuid is required by Flow 6,
  // and existing field values are used as fallbacks if Graph returned nulls.
  const tenantRes = await client.query(
    `SELECT tenantuuid, tenantname, tenantemail, dynamicsaccountid, admingroupid, usergroupid, isactive, isapproved
     FROM public.tenant WHERE entratenantid = $1`,
    [tenant],
  );
  const current = tenantRes.rows[0] ?? null;

  if (!current) {
    console.warn(`[STEP 4] ⚠️ Could not resolve tenant row for tenant=${tenant} — Flow 6 will be skipped`);
    return { tenantUuid: null, current: null };
  }

  console.log(`[STEP 4] ✅ Resolved tenantuuid=${current.tenantuuid}`);
  return { tenantUuid: current.tenantuuid, current };
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
  const adminGroupId = adminGroup.id;

  let usersGroup = await findGroup("PowerIntake.Users");
  if (usersGroup) {
    console.log(`[FLOW 2] Group already exists: PowerIntake.Users → ${usersGroup.id}`);
  } else {
    usersGroup = await createGroup("PowerIntake.Users");
  }
  const usersGroupId = usersGroup.id;

  console.log(`[FLOW 2] ✅ Groups ensured — adminGroupId=${adminGroupId} | usersGroupId=${usersGroupId}`);

  // Wait for Microsoft's directory to propagate newly created groups.
  // Without this, Flow 3 member adds and Flow 4 member reads return 404.
  console.log("[FLOW 2] ⏳ Waiting 5s for directory propagation before proceeding...");
  await new Promise((r) => setTimeout(r, 5000));

  return { adminGroupId, usersGroupId };
};

// ─── Flow 3: Assign Global Admin to Both Groups ───────────────────────────────
// Skip the pre-check GET /members?$filter — unsupported on fresh groups (404).
// Attempt the add directly; treat HTTP 400 "already exists" as success.

const flow3_assignAdminToGroups = async (headers, adminOid, adminGroupId, usersGroupId) => {
  console.log(`[FLOW 3] Assigning admin ${adminOid} to both groups...`);

  const addToGroup = async (groupId) => {
    try {
      await withRetry(`addMember group=${groupId}`, () =>
        axios.post(
          `${GRAPH_URL}/groups/${groupId}/members/$ref`,
          { "@odata.id": `${GRAPH_URL}/directoryObjects/${adminOid}` },
          { headers, timeout: 10000 },
        ),
      );
      console.log(`[FLOW 3] ✅ Added admin ${adminOid} to group ${groupId}`);
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.error?.message ?? err.message;

      if (status === 400 && msg?.toLowerCase().includes("already exist")) {
        console.log(`[FLOW 3] Admin already in group ${groupId} (conflict ignored)`);
      } else {
        console.warn(`[FLOW 3] ⚠️ Failed to add admin to group ${groupId}: ${msg}`);
      }
    }
  };

  await Promise.allSettled([addToGroup(adminGroupId), addToGroup(usersGroupId)]);
  console.log("[FLOW 3] ✅ Admin assignment complete");
};

// ─── Flow 4: Batch Assign Active Tenant Users to PowerIntake.Users ────────────
// Only accountEnabled=true users are fetched. Existing members are fetched with
// retry (propagation lag) and used to skip duplicates before batching.

const flow4_batchAssignUsersToGroup = async (headers, usersGroupId) => {
  console.log("[FLOW 4] Batch assigning active tenant users to PowerIntake.Users...");

  const fetchActiveUsers = async () => {
    // Strategy 1 — standard filter
    try {
      console.log("[FLOW 4] Strategy 1 — Fetching active users (standard query)...");
      let users    = [];
      let nextLink = `${GRAPH_URL}/users?$filter=accountEnabled eq true&$select=id&$top=999`;
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
      const isUnsupported =
        err.response?.status === 400 &&
        (errCode === "Request_UnsupportedQuery" || errMsg.includes("ConsistencyLevel"));

      if (!isUnsupported) throw err;
      console.warn(`[FLOW 4] Strategy 1 ⚠️ Unsupported on this tenant (${errCode}), trying Strategy 2...`);
    }

    // Strategy 2 — advanced query mode
    try {
      console.log("[FLOW 4] Strategy 2 — Fetching active users (advanced query mode)...");
      const advancedHeaders = { ...headers, "ConsistencyLevel": "eventual" };
      let users    = [];
      let nextLink = `${GRAPH_URL}/users?$filter=accountEnabled eq true&$select=id&$top=999&$count=true`;
      while (nextLink) {
        const { data } = await axios.get(nextLink, { headers: advancedHeaders, timeout: 15000 });
        users.push(...data.value);
        nextLink = data["@odata.nextLink"] ?? null;
      }
      console.log(`[FLOW 4] Strategy 2 ✅ Fetched ${users.length} active users`);
      return { users, filtered: true };
    } catch (err) {
      console.warn(
        `[FLOW 4] Strategy 2 ⚠️ Advanced query also failed: ${err.response?.data?.error?.message ?? err.message}`,
      );
      console.warn("[FLOW 4] Strategy 3 — Falling back to fetching all users unfiltered...");
    }

    // Strategy 3 — unfiltered fallback
    let users    = [];
    let nextLink = `${GRAPH_URL}/users?$select=id&$top=999`;
    while (nextLink) {
      const { data } = await axios.get(nextLink, { headers, timeout: 15000 });
      users.push(...data.value);
      nextLink = data["@odata.nextLink"] ?? null;
    }
    console.log(
      `[FLOW 4] Strategy 3 ✅ Fetched ${users.length} users (unfiltered — includes disabled accounts)`,
    );
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

  // Fetch existing PowerIntake.Users members to avoid duplicate adds.
  // withRetry handles transient 404s from directory propagation lag.
  const existingMemberIds = new Set();
  await withRetry(`fetch existing members for group=${usersGroupId}`, async () => {
    existingMemberIds.clear();
    let membersLink = `${GRAPH_URL}/groups/${usersGroupId}/members?$select=id&$top=999`;
    while (membersLink) {
      const { data } = await axios.get(membersLink, { headers, timeout: 15000 });
      data.value.forEach((m) => existingMemberIds.add(m.id));
      membersLink = data["@odata.nextLink"] ?? null;
    }
  });

  const usersToAdd = allUsers.filter((u) => !existingMemberIds.has(u.id));

  if (usersToAdd.length === 0) {
    console.log(`[FLOW 4] All ${allUsers.length} active users already in PowerIntake.Users`);
    return;
  }

  console.log(
    `[FLOW 4] Adding ${usersToAdd.length} active users (${existingMemberIds.size} already members, skipped)...`,
  );

  const chunkSize = 20;
  for (let i = 0; i < usersToAdd.length; i += chunkSize) {
    const chunk    = usersToAdd.slice(i, i + chunkSize);
    const rangeEnd = Math.min(i + chunkSize, usersToAdd.length);

    try {
      await withRetry(`add users chunk ${i + 1}–${rangeEnd}`, () =>
        axios.patch(
          `${GRAPH_URL}/groups/${usersGroupId}`,
          { "members@odata.bind": chunk.map((u) => `${GRAPH_URL}/directoryObjects/${u.id}`) },
          { headers, timeout: 15000 },
        ),
      );
      console.log(`[FLOW 4] Users chunk added: ${i + 1}–${rangeEnd} of ${usersToAdd.length}`);
    } catch (err) {
      console.warn(
        `[FLOW 4] ⚠️ Chunk ${i + 1}–${rangeEnd} failed after retries:`,
        err.response?.data?.error?.message ?? err.message,
      );
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

// ─── Flow 6: Full Tenant Update to DB ────────────────────────────────────────
// Replaces tenant_update_groups with the full tenant_update function so that
// tenantname (Graph displayName) and tenantemail (technicalNotificationMails[0])
// are persisted alongside the group IDs in a single atomic operation.
//
// Field resolution priority:
//   - tenantName  → Graph displayName        → fallback: existing DB value
//   - tenantEmail → technicalNotificationMails[0] → fallback: existing DB value
//   - dynamicsAccountId                      → fallback: existing DB value
//   - adminGroupId / usersGroupId            → resolved in Flow 2 (never null here)
//   - isactive / isapproved                  → preserved from current DB row
//   - isconsented                            → always true (set in Step 4)

const flow6_persistTenantUpdate = async (
  tenantUuid,
  tenant,
  current,
  tenantName,
  tenantEmail,
  dynamicsAccountId,
  adminGroupId,
  usersGroupId,
) => {
  console.log(`[FLOW 6] Running full tenant_update for tenantUuid=${tenantUuid}...`);

  // Prefer real Graph/Dynamics data; fall back to whatever is already in the DB
  // so we never overwrite a good value with null.
  const finalTenantName       = tenantName        || current.tenantname;
  const finalTenantEmail      = tenantEmail        || current.tenantemail;
  const finalDynamicsAccountId = dynamicsAccountId || current.dynamicsaccountid;

  if (!finalTenantName) {
    throw new Error(
      `[FLOW 6] Cannot update tenant — tenantname is null in both Graph and DB for tenant=${tenant}`,
    );
  }

  console.log(`[FLOW 6] tenantName=${finalTenantName} | tenantEmail=${finalTenantEmail} | dynamicsAccountId=${finalDynamicsAccountId}`);
  console.log(`[FLOW 6] adminGroupId=${adminGroupId} | usersGroupId=${usersGroupId}`);

  await client.query(
    `SELECT public.tenant_update($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      tenantUuid,              // p_tenantuuid
      tenant,                  // p_entratenantid
      finalTenantName,         // p_tenantname       ← Graph displayName
      finalTenantEmail,        // p_tenantemail       ← technicalNotificationMails[0]
      finalDynamicsAccountId,  // p_dynamicsaccountid
      adminGroupId,            // p_admingroupid      ← resolved in Flow 2
      usersGroupId,            // p_usergroupid       ← resolved in Flow 2
      current.isactive  ?? true,   // p_isactive
      true,                    // p_isconsented       ← always true at this point
      current.isapproved ?? false, // p_isapproved
    ],
  );

  console.log(`[FLOW 6] ✅ tenant_update complete — tenantName=${finalTenantName} | email=${finalTenantEmail} | adminGroupId=${adminGroupId} | usersGroupId=${usersGroupId}`);
};

// ─── Full Provisioning Orchestrator ──────────────────────────────────────────
// Awaited by consent_Callback — the HTTP response is held until this resolves.
// tenantName, tenantEmail, dynamicsAccountId from Step 2 are threaded through
// so Flow 6 can write them to the DB in the same tenant_update call.

const runPostConsentFlow = async ({
  token,
  tenant,
  adminOid,
  tenantUuid,
  current,
  tenantName,
  tenantEmail,
  dynamicsAccountId,
}) => {
  console.log("[POST-CONSENT] ── Starting provisioning flow ────────────");
  const headers = makeHeaders(token);

  const enterpriseSp                   = await flow1_resolveEnterpriseSp(headers);
  const { adminGroupId, usersGroupId } = await flow2_ensureGroups(headers);

  await flow3_assignAdminToGroups(headers, adminOid, adminGroupId, usersGroupId);
  await flow4_batchAssignUsersToGroup(headers, usersGroupId);
  await flow5_assignGroupsToAppRoles(headers, adminGroupId, usersGroupId, enterpriseSp.id);

  if (tenantUuid && current) {
    await flow6_persistTenantUpdate(
      tenantUuid,
      tenant,
      current,
      tenantName,
      tenantEmail,
      dynamicsAccountId,
      adminGroupId,
      usersGroupId,
    );
  } else {
    console.warn("[POST-CONSENT] ⚠️ Skipping Flow 6 — tenantUuid or current row is null");
  }

  console.log("[POST-CONSENT] ✅ Full provisioning flow completed successfully");
};

// ─── Consent Callback (Main Entry Point) ─────────────────────────────────────
// Sequence:
//   Step 1 — Acquire app-only token
//   Step 2 — Fetch Graph org info (displayName, technicalNotificationMails) + Dynamics
//   Step 3 — Auto-grant Graph app permissions (non-fatal)
//   Step 4 — Flip isconsented=true; resolve tenantuuid + current DB row
//   Flows 1–6 — Full provisioning, awaited (frontend blocked until Flow 6 DB write)
//   → Respond with consent=success ONLY after Flow 6 completes

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
    const token = await step1_acquireToken(tenant);

    // Step 2 — Graph org info (displayName + technicalNotificationMails) + Dynamics
    const { tenantName, tenantDomain, tenantEmail, dynamicsAccountId } =
      await step2_fetchOrgAndDynamics(token, tenant);

    // Step 3 — Auto-grant Graph app permissions (non-fatal)
    try {
      await step3_grantGraphPermissions(token);
    } catch (grantErr) {
      console.warn("[CONSENT] Step 3 ⚠️ Could not auto-grant Graph permissions:", grantErr.message);
    }

    // Step 4 — Flip isconsented=true; resolve tenantuuid and full current DB row
    const { tenantUuid, current } = await step4_markTenantConsented(tenant);

    // Flows 1–6 — Await the full provisioning chain.
    // The frontend loading screen stays active until this resolves.
    console.log("[CONSENT] ⏳ Running full provisioning flow before responding...");
    await runPostConsentFlow({
      token,
      tenant,
      adminOid,
      tenantUuid,
      current,
      tenantName,       // Graph displayName
      tenantEmail,      // technicalNotificationMails[0]
      dynamicsAccountId,
    });

    // Only reached after Flow 6 has written all fields to the DB
    console.log("[CONSENT] ✅ Provisioning complete — responding with consent=success");
    return res.json({ redirectUrl: "/consent-callback?consent=success" });

  } catch (err) {
    console.error("[CONSENT] ❌ Unhandled exception:", err.message);
    console.error(err.stack);
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }
};

module.exports = { consent_Callback };