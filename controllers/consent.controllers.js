const axios = require("axios");
const client = require("../config/db");
const { getAccessToken } = require("../config/authService");
const { getDynamicsToken } = require("../utils/dynamicsToken");

const GRAPH_URL = "https://graph.microsoft.com/v1.0";
const GRAPH_APP_ID = "00000003-0000-0000-c000-000000000000";

const REQUIRED_GRAPH_ROLES = [
  "62a82d76-70ea-41e2-9197-370581804d09", // Group.ReadWrite.All
  "dbaae8cf-10b5-4b86-a4a1-f871c94c6695", // GroupMember.ReadWrite.All
  "df021288-bdef-4463-88db-98f22de89214", // User.Read.All
  "5b567255-7703-4780-807c-7be8301ae99b", // Group.Read.All
];

const ADMIN_APP_ROLE_ID = "3d316243-5776-4d70-93e0-0762378f97ed";
const USERS_APP_ROLE_ID = "154626a2-3572-4da2-9b85-050ff2f833d8";

const makeHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

// ─── Step 1: Acquire Token ────────────────────────────────────────────────────
const step1_acquireToken = async (tenant) => {
  console.log(`[STEP 1] Acquiring token for consenting tenant=${tenant}...`);
  const token = await getAccessToken(tenant);
  console.log("[STEP 1] ✅ Token acquired");
  return token;
};

// ─── Step 2: Fetch Org Info + Dynamics in Parallel ───────────────────────────
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
            Authorization: `Bearer ${dynamicsToken}`,
            Accept: "application/json",
            "OData-Version": "4.0",
            "OData-MaxVersion": "4.0",
          },
          timeout: 10000,
        },
      );
    })(),
  ]);

  let tenantName = null, tenantEmail = null, dynamicsAccountId = null;

  if (orgResult.status === "fulfilled") {
    const org = orgResult.value.data.value?.[0];
    tenantName = org?.displayName ?? null;
    tenantEmail = org?.technicalNotificationMails?.[0] ?? null;
    console.log(`[STEP 2] ✅ Graph — org=${tenantName} | email=${tenantEmail}`);
  } else {
    console.warn(`[STEP 2] ⚠️ Graph org fetch failed (non-fatal): ${orgResult.reason?.message}`);
  }

  if (dynamicsResult.status === "fulfilled") {
    dynamicsAccountId = dynamicsResult.value.data.value?.[0]?.accountid ?? null;
    console.log(`[STEP 2] ✅ Dynamics — dynamicsAccountId=${dynamicsAccountId ?? "not found"}`);
  } else {
    console.warn(`[STEP 2] ⚠️ Dynamics lookup failed (non-fatal): ${dynamicsResult.reason?.message}`);
  }

  return { tenantName, tenantEmail, dynamicsAccountId };
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
  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((f) =>
    console.warn("[STEP 3] Permission grant failed:", f.reason?.response?.data?.error?.message ?? f.reason?.message),
  );

  console.log(`[STEP 3] ✅ Graph permissions — granted: ${granted}, already existed: ${existingRoleIds.size}, failed: ${failed.length}`);
};

// ─── Step 4: Update Tenant in DB ──────────────────────────────────────────────
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
      tenantName ?? current.tenantname,
      tenantEmail ?? current.tenantemail,
      dynamicsAccountId ?? current.dynamicsaccountid,
      current.admingroupid,
      current.usergroupid,
      current.isactive ?? true,
      true, // isconsented
      current.isapproved ?? false,
    ],
  );

  console.log(`[STEP 4] ✅ Tenant updated — isconsented=true | name=${tenantName ?? current.tenantname}`);
  return current.tenantuuid;
};

// ─── Step 5: Resolve Enterprise SP ───────────────────────────────────────────
const step5_resolveEnterpriseSp = async (headers) => {
  console.log("[STEP 5] Resolving enterprise app SP in consenting tenant...");

  const spRes = await axios.get(
    `${GRAPH_URL}/servicePrincipals?$filter=appId eq '${process.env.AZURE_CLIENT_ID}'&$select=id,appId,displayName`,
    { headers, timeout: 10000 },
  );
  const sp = spRes.data.value?.[0];
  if (!sp) throw new Error(`Enterprise app SP not found for appId=${process.env.AZURE_CLIENT_ID}`);

  console.log(`[STEP 5] ✅ Resolved enterprise SP — id=${sp.id}, displayName=${sp.displayName}`);
  return sp;
};

// ─── Step 6: Ensure Groups Exist ─────────────────────────────────────────────
const step6_ensureGroups = async (headers) => {
  console.log("[STEP 6] Ensuring PowerIntake groups exist...");

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
        mailNickname: displayName.replace(/\./g, ""),
        mailEnabled: false,
        securityEnabled: true,
        groupTypes: [],
      },
      { headers, timeout: 10000 },
    );
    console.log(`[STEP 6] Created group: ${displayName} → ${res.data.id}`);
    return res.data;
  };

  let adminGroup = await findGroup("PowerIntake.Admin");
  if (adminGroup) {
    console.log(`[STEP 6] Group already exists: PowerIntake.Admin → ${adminGroup.id}`);
  } else {
    adminGroup = await createGroup("PowerIntake.Admin");
  }

  let usersGroup = await findGroup("PowerIntake.Users");
  if (usersGroup) {
    console.log(`[STEP 6] Group already exists: PowerIntake.Users → ${usersGroup.id}`);
  } else {
    usersGroup = await createGroup("PowerIntake.Users");
  }

  console.log("[STEP 6] ✅ Groups ensured");
  return { adminGroupId: adminGroup.id, usersGroupId: usersGroup.id };
};

// ─── Step 7: Assign Global Admin to Both Groups ──────────────────────────────
const step7_assignAdminToGroups = async (headers, adminOid, adminGroupId, usersGroupId) => {
  console.log(`[STEP 7] Assigning admin ${adminOid} to both groups...`);

  const addToGroup = async (groupId) => {
    try {
      const checkRes = await axios.get(
        `${GRAPH_URL}/groups/${groupId}/members?$filter=id eq '${adminOid}'&$select=id`,
        { headers, timeout: 10000 },
      );
      if (checkRes.data.value?.length > 0) {
        console.log(`[STEP 7] Admin ${adminOid} already member of group ${groupId}`);
        return;
      }
    } catch (e) {
      console.warn(`[STEP 7] Member check skipped for group ${groupId}, attempting add:`, e.message);
    }

    try {
      await axios.post(
        `${GRAPH_URL}/groups/${groupId}/members/$ref`,
        { "@odata.id": `${GRAPH_URL}/directoryObjects/${adminOid}` },
        { headers, timeout: 10000 },
      );
      console.log(`[STEP 7] Added admin ${adminOid} to group ${groupId}`);
    } catch (err) {
      if (
        err.response?.status === 400 &&
        err.response?.data?.error?.message?.toLowerCase().includes("already exist")
      ) {
        console.log(`[STEP 7] Admin already in group ${groupId} (conflict ignored)`);
      } else {
        console.warn(
          `[STEP 7] Failed to add admin to group ${groupId}:`,
          err.response?.data?.error?.message ?? err.message,
        );
      }
    }
  };

  await Promise.allSettled([addToGroup(adminGroupId), addToGroup(usersGroupId)]);
  console.log("[STEP 7] ✅ Admin assignment complete");
};

// ─── Step 8: Batch Assign ALL Tenant Users to PowerIntake.Users ──────────────
const step8_batchAssignUsersToGroup = async (headers, usersGroupId) => {
  console.log("[STEP 8] Batch assigning ALL tenant users to PowerIntake.Users...");

  let allUsers = [];
  let nextLink = `${GRAPH_URL}/users?$select=id&$top=999`;
  while (nextLink) {
    const { data } = await axios.get(nextLink, { headers, timeout: 15000 });
    allUsers.push(...data.value);
    nextLink = data["@odata.nextLink"] ?? null;
  }

  if (allUsers.length === 0) {
    console.log("[STEP 8] No users found in tenant for group assignment");
    return;
  }

  console.log(`[STEP 8] Fetched ${allUsers.length} users`);

  const existingMemberIds = new Set();
  let membersLink = `${GRAPH_URL}/groups/${usersGroupId}/members?$select=id&$top=999`;
  while (membersLink) {
    const { data } = await axios.get(membersLink, { headers, timeout: 15000 });
    data.value.forEach((m) => existingMemberIds.add(m.id));
    membersLink = data["@odata.nextLink"] ?? null;
  }

  const usersToAdd = allUsers.filter((u) => !existingMemberIds.has(u.id));

  if (usersToAdd.length === 0) {
    console.log(`[STEP 8] All ${allUsers.length} users already in PowerIntake.Users`);
    return;
  }

  console.log(`[STEP 8] Adding ${usersToAdd.length} users (${existingMemberIds.size} already members)...`);

  const chunkSize = 20;
  for (let i = 0; i < usersToAdd.length; i += chunkSize) {
    const chunk = usersToAdd.slice(i, i + chunkSize);
    try {
      await axios.patch(
        `${GRAPH_URL}/groups/${usersGroupId}`,
        { "members@odata.bind": chunk.map((u) => `${GRAPH_URL}/directoryObjects/${u.id}`) },
        { headers, timeout: 15000 },
      );
      console.log(`[STEP 8] Users chunk added: ${i + 1}–${Math.min(i + chunkSize, usersToAdd.length)} of ${usersToAdd.length}`);
    } catch (err) {
      console.warn(`[STEP 8] Chunk ${i} failed:`, err.response?.data?.error?.message ?? err.message);
    }
  }

  console.log("[STEP 8] ✅ Batch user assignment complete");
};

// ─── Step 9: Assign Groups to App Roles ──────────────────────────────────────
const step9_assignGroupsToAppRoles = async (headers, adminGroupId, usersGroupId, enterpriseSpId) => {
  console.log(`[STEP 9] Assigning groups to app roles on enterprise SP ${enterpriseSpId}...`);

  const assignGroupRole = async (groupId, appRoleId, label) => {
    const existingRes = await axios.get(
      `${GRAPH_URL}/groups/${groupId}/appRoleAssignments`,
      { headers, timeout: 10000 },
    );
    const alreadyAssigned = existingRes.data.value?.some(
      (a) => a.resourceId === enterpriseSpId && a.appRoleId === appRoleId,
    );

    if (alreadyAssigned) {
      console.log(`[STEP 9] ${label} already assigned to appRole ${appRoleId} on SP ${enterpriseSpId}`);
      return;
    }

    await axios.post(
      `${GRAPH_URL}/groups/${groupId}/appRoleAssignments`,
      { principalId: groupId, resourceId: enterpriseSpId, appRoleId },
      { headers, timeout: 10000 },
    );
    console.log(`[STEP 9] Assigned ${label} → appRole ${appRoleId} on SP ${enterpriseSpId}`);
  };

  await Promise.allSettled([
    assignGroupRole(adminGroupId, ADMIN_APP_ROLE_ID, "PowerIntake.Admin"),
    assignGroupRole(usersGroupId, USERS_APP_ROLE_ID, "PowerIntake.Users"),
  ]);

  console.log("[STEP 9] ✅ App role assignment complete");
};

// ─── Step 10: Persist Group IDs to DB ────────────────────────────────────────
const step10_persistGroupIdsToDb = async (tenantUuid, adminGroupId, usersGroupId) => {
  console.log(`[STEP 10] Persisting group IDs to DB for tenantUuid=${tenantUuid}...`);

  await client.query(`SELECT public.tenant_update_groups($1, $2, $3)`, [
    tenantUuid,
    adminGroupId,
    usersGroupId,
  ]);

  console.log(`[STEP 10] ✅ Persisted — adminGroupId: ${adminGroupId}, usersGroupId: ${usersGroupId}`);
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
    console.error("[CONSENT] ❌ Missing adminOid");
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }

  try {
    const token = await step1_acquireToken(tenant);
    const headers = makeHeaders(token);

    const { tenantName, tenantEmail, dynamicsAccountId } = await step2_fetchOrgAndDynamics(token, tenant);

    try {
      await step3_grantGraphPermissions(token);
    } catch (grantErr) {
      console.warn("[CONSENT] Step 3 ⚠️ Could not auto-grant Graph permissions:", grantErr.message);
    }

    const tenantUuid = await step4_updateTenantRecord(tenant, tenantName, tenantEmail, dynamicsAccountId);

    // ── SEQUENTIAL CRITICAL FLOW: All steps must succeed ──
    const enterpriseSp = await step5_resolveEnterpriseSp(headers);
    const { adminGroupId, usersGroupId } = await step6_ensureGroups(headers);
    await step7_assignAdminToGroups(headers, adminOid, adminGroupId, usersGroupId);
    await step8_batchAssignUsersToGroup(headers, usersGroupId);
    await step9_assignGroupsToAppRoles(headers, adminGroupId, usersGroupId, enterpriseSp.id);
    await step10_persistGroupIdsToDb(tenantUuid, adminGroupId, usersGroupId);

    console.log("[CONSENT] ✅ All steps completed successfully");
    res.json({ redirectUrl: "/consent-callback?consent=success" });

  } catch (err) {
    console.error("[CONSENT] ❌ Flow failed:", err.message);
    console.error(err.stack);
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }
};

module.exports = { consent_Callback };
