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
// Returns org data for later use in Flow 6. No other steps are affected.

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

const step4_markTenantConsented = async (tenant) => {
  console.log(`[STEP 4] Marking tenant as consented — entratenantid=${tenant}...`);

  const result = await client.query(
    `SELECT updated, message FROM public.tenant_update_isconsented($1, $2)`,
    [tenant, true],
  );

  const row = result.rows[0];
  console.log(`[STEP 4] ✅ DB response — updated=${row?.updated} | message=${row?.message}`);

  const tenantRes = await client.query(
    `SELECT tenantuuid, entratenantid, tenantname FROM public.tenant WHERE entratenantid = $1`,
    [tenant],
  );
  const tenantRow  = tenantRes.rows[0] ?? null;
  const tenantUuid = tenantRow?.tenantuuid ?? null;

  if (!tenantUuid) {
    console.warn(`[STEP 4] ⚠️ Could not resolve tenantuuid for tenant=${tenant} — Flow 6 will be skipped`);
  } else {
    console.log(`[STEP 4] ✅ Resolved tenantuuid=${tenantUuid} | tenantname=${tenantRow.tenantname}`);
  }

  return {
    tenantUuid,
    entratenantid: tenantRow?.entratenantid ?? tenant,
    tenantname:    tenantRow?.tenantname    ?? null,
  };
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

  console.log("[FLOW 2] ⏳ Waiting 5s for directory propagation before proceeding...");
  await new Promise((r) => setTimeout(r, 5000));

  return { adminGroupId, usersGroupId };
};

// ─── Flow 3: Assign Global Admin to Both Groups ───────────────────────────────

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

const flow4_batchAssignUsersToGroup = async (headers, usersGroupId) => {
  console.log("[FLOW 4] Batch assigning active tenant users to PowerIntake.Users...");

  const fetchActiveUsers = async () => {
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

// ─── Flow 6: Persist All Tenant Data to DB ───────────────────────────────────
// Calls tenant_update with the full set of fields: groups resolved in Flows 1–5,
// plus org info (tenantName, tenantEmail, dynamicsAccountId) fetched in Step 2.
// This is intentionally separate from step2_fetchOrgAndDynamics so Step 2 stays
// non-fatal and purely informational — Flow 6 is the single authoritative DB write.

const flow6_persistAllTenantData = async ({
  tenantUuid,
  entratenantid,
  tenantname,
  tenantemail,
  dynamicsaccountid,
  adminGroupId,
  usersGroupId,
}) => {
  console.log(`[FLOW 6] Persisting all tenant data to DB for tenantUuid=${tenantUuid}...`);
  console.log(`[FLOW 6] tenantname=${tenantname} | tenantemail=${tenantemail} | dynamicsaccountid=${dynamicsaccountid}`);
  console.log(`[FLOW 6] adminGroupId=${adminGroupId} | usersGroupId=${usersGroupId}`);

  await client.query(
    `SELECT public.tenant_update($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      tenantUuid,        // p_tenantuuid        uuid
      entratenantid,     // p_entratenantid      text
      tenantname,        // p_tenantname         text
      tenantemail,       // p_tenantemail        text    (COALESCE — only overwrites if provided)
      dynamicsaccountid, // p_dynamicsaccountid  text    (COALESCE — only overwrites if provided)
      adminGroupId,      // p_admingroupid       text    (COALESCE — only overwrites if provided)
      usersGroupId,      // p_usergroupid        text    (COALESCE — only overwrites if provided)
      null,              // p_isactive           boolean (no change)
      null,              // p_isconsented        boolean (already set in Step 4)
      null,              // p_isapproved         boolean (no change)
    ],
  );

  console.log(`[FLOW 6] ✅ tenant_update complete — all provisioning data persisted`);
};

// ─── Full Provisioning Orchestrator ──────────────────────────────────────────

const runPostConsentFlow = async ({
  token,
  tenant,
  adminOid,
  tenantUuid,
  entratenantid,
  tenantname,
  tenantemail,
  dynamicsaccountid,
}) => {
  console.log("[POST-CONSENT] ── Starting provisioning flow ────────────");
  const headers = makeHeaders(token);

  const enterpriseSp                   = await flow1_resolveEnterpriseSp(headers);
  const { adminGroupId, usersGroupId } = await flow2_ensureGroups(headers);

  await flow3_assignAdminToGroups(headers, adminOid, adminGroupId, usersGroupId);
  await flow4_batchAssignUsersToGroup(headers, usersGroupId);
  await flow5_assignGroupsToAppRoles(headers, adminGroupId, usersGroupId, enterpriseSp.id);

  if (tenantUuid) {
    await flow6_persistAllTenantData({
      tenantUuid,
      entratenantid,
      tenantname,
      tenantemail,
      dynamicsaccountid,
      adminGroupId,
      usersGroupId,
    });
  } else {
    console.warn("[POST-CONSENT] ⚠️ Skipping Flow 6 — tenantUuid is null");
  }

  console.log("[POST-CONSENT] ✅ Full provisioning flow completed successfully");
};

// ─── Consent Callback (Main Entry Point) ─────────────────────────────────────

const consent_Callback = async (req, res) => {
  const { tenant, admin_consent, error } = req.query;
  const adminOid = req.user?.oid || req.user?.sub;

  console.log("[CONSENT] ── Callback received ──────────────────────────────");
  console.log(`[CONSENT] tenant=${tenant} | admin_consent=${admin_consent} | error=${error ?? "none"}`);
  console.log(`[CONSENT] adminOid=${adminOid ?? "MISSING"}`);

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
    // Step 1 — Acquire app-only token
    const token = await step1_acquireToken(tenant);

    // Step 2 — Graph org info + Dynamics (both non-fatal)
    // Org data is stored here and forwarded to Flow 6 — Step 2 itself is unchanged
    const { tenantName, tenantEmail, dynamicsAccountId } =
      await step2_fetchOrgAndDynamics(token, tenant);

    // Step 3 — Auto-grant Graph app permissions (non-fatal)
    try {
      await step3_grantGraphPermissions(token);
    } catch (grantErr) {
      console.warn("[CONSENT] Step 3 ⚠️ Could not auto-grant Graph permissions:", grantErr.message);
    }

    // Step 4 — Flip isconsented=true; resolve tenantuuid + existing DB name as fallback
    const { tenantUuid, entratenantid, tenantname: dBTenantName } =
      await step4_markTenantConsented(tenant);

    // Flows 1–6 — Full provisioning chain.
    // Flow 6 uses tenant_update with groups + org info from Step 2.
    // If Step 2 returned nulls (Graph failed), COALESCE in tenant_update preserves existing DB values.
    console.log("[CONSENT] ⏳ Running full provisioning flow before responding...");
    await runPostConsentFlow({
      token,
      tenant,
      adminOid,
      tenantUuid,
      entratenantid,
      tenantname:        tenantName    ?? dBTenantName, // prefer fresh Graph name, fall back to DB value
      tenantemail:       tenantEmail,
      dynamicsaccountid: dynamicsAccountId,
    });

    console.log("[CONSENT] ✅ Provisioning complete — responding with consent=success");
    return res.json({ redirectUrl: "/consent-callback?consent=success" });

  } catch (err) {
    console.error("[CONSENT] ❌ Unhandled exception:", err.message);
    console.error(err.stack);
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }
};

module.exports = { consent_Callback };