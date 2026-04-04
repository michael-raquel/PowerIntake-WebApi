const axios = require("axios");
const client = require("../config/db");
const { getAccessToken } = require("../config/authService");

const GRAPH_URL = "https://graph.microsoft.com/v1.0";
const GRAPH_APP_ID = "00000003-0000-0000-c000-000000000000";

const REQUIRED_GRAPH_ROLES = [
  "62a82d76-70ea-41e2-9197-370581804d09", // Group.ReadWrite.All
  "dbaae8cf-10b5-4b86-a4a1-f871c94c6695", // GroupMember.ReadWrite.All
  "df021288-bdef-4463-88db-98f22de89214", // User.Read.All
  "5b567255-7703-4780-807c-7be8301ae99b", // Group.Read.All
];

const ADMIN_APP_ROLE_ID = "3d316243-5776-4d70-93e0-0762378f97ed"; // PowerIntake.Admin
const USERS_APP_ROLE_ID = "154626a2-3572-4da2-9b85-050ff2f833d8"; // PowerIntake.Users

// ─── Grant Graph Permissions ──────────────────────────────────────────────────
const grantGraphPermissions = async (token) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const ourSpRes = await axios.get(
    `${GRAPH_URL}/servicePrincipals?$filter=appId eq '${process.env.AZURE_CLIENT_ID}'&$select=id,appId,displayName`,
    { headers },
  );
  const ourSp = ourSpRes.data.value?.[0];
  if (!ourSp)
    throw new Error("Our service principal not found on client tenant");

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
  const existingRoleIds = new Set(
    existingRes.data.value.map((a) => a.appRoleId),
  );

  const results = await Promise.allSettled(
    REQUIRED_GRAPH_ROLES.filter((roleId) => !existingRoleIds.has(roleId)).map(
      (appRoleId) =>
        axios.post(
          `${GRAPH_URL}/servicePrincipals/${ourSp.id}/appRoleAssignments`,
          { principalId: ourSp.id, resourceId: graphSp.id, appRoleId },
          { headers },
        ),
    ),
  );

  const granted = results.filter((r) => r.status === "fulfilled").length;
  const skipped = existingRoleIds.size;
  const failed = results.filter((r) => r.status === "rejected");

  failed.forEach((f) =>
    console.warn(
      "[CONSENT] Permission grant failed:",
      f.reason?.response?.data?.error?.message ?? f.reason?.message,
    ),
  );

  console.log(
    `[CONSENT] Graph permissions — granted: ${granted}, already existed: ${skipped}, failed: ${failed.length}`,
  );
};

// ─── Flow 1: Ensure Groups Exist ─────────────────────────────────────────────
const ensureGroups = async (headers) => {
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
    console.log(
      `[POST-CONSENT] Created group: ${displayName} → ${res.data.id}`,
    );
    return res.data;
  };

  let adminGroup = await findGroup("PowerIntake.Admin");
  if (adminGroup) {
    console.log(
      `[POST-CONSENT] Group already exists: PowerIntake.Admin → ${adminGroup.id}`,
    );
  } else {
    adminGroup = await createGroup("PowerIntake.Admin");
  }

  let usersGroup = await findGroup("PowerIntake.Users");
  if (usersGroup) {
    console.log(
      `[POST-CONSENT] Group already exists: PowerIntake.Users → ${usersGroup.id}`,
    );
  } else {
    usersGroup = await createGroup("PowerIntake.Users");
  }

  return { adminGroupId: adminGroup.id, usersGroupId: usersGroup.id };
};

// ─── Flow 2: Assign Global Admin to Both Groups ───────────────────────────────
const assignAdminToGroups = async (
  headers,
  adminOid,
  adminGroupId,
  usersGroupId,
) => {
  const addToGroup = async (groupId) => {
    try {
      const checkRes = await axios.get(
        `${GRAPH_URL}/groups/${groupId}/members?$filter=id eq '${adminOid}'&$select=id`,
        { headers, timeout: 10000 },
      );
      if (checkRes.data.value?.length > 0) {
        console.log(
          `[POST-CONSENT] Admin ${adminOid} already member of group ${groupId}`,
        );
        return;
      }
    } catch (e) {
      console.warn(
        `[POST-CONSENT] Member check skipped for group ${groupId}, attempting add:`,
        e.message,
      );
    }

    try {
      await axios.post(
        `${GRAPH_URL}/groups/${groupId}/members/$ref`,
        { "@odata.id": `${GRAPH_URL}/directoryObjects/${adminOid}` },
        { headers, timeout: 10000 },
      );
      console.log(`[POST-CONSENT] Added admin ${adminOid} to group ${groupId}`);
    } catch (err) {
      if (
        err.response?.status === 400 &&
        err.response?.data?.error?.message
          ?.toLowerCase()
          .includes("already exist")
      ) {
        console.log(
          `[POST-CONSENT] Admin already in group ${groupId} (conflict ignored)`,
        );
      } else {
        console.warn(
          `[POST-CONSENT] Failed to add admin to group ${groupId}:`,
          err.response?.data?.error?.message ?? err.message,
        );
      }
    }
  };

  await Promise.allSettled([
    addToGroup(adminGroupId),
    addToGroup(usersGroupId),
  ]);
};

// ─── Flow 3: Batch Assign All Tenant Users to PowerIntake.Users ───────────────
const batchAssignUsersToGroup = async (headers, usersGroupId) => {
  let allUsers = [];
  let nextLink = `${GRAPH_URL}/users?$select=id&$top=999`;
  while (nextLink) {
    const { data } = await axios.get(nextLink, { headers, timeout: 15000 });
    allUsers.push(...data.value);
    nextLink = data["@odata.nextLink"] ?? null;
  }

  if (allUsers.length === 0) {
    console.log("[POST-CONSENT] No users found in tenant for group assignment");
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
    console.log(
      `[POST-CONSENT] All ${allUsers.length} users already in PowerIntake.Users`,
    );
    return;
  }

  console.log(
    `[POST-CONSENT] Adding ${usersToAdd.length} users to PowerIntake.Users ` +
      `(${existingMemberIds.size} already members)`,
  );

  const chunkSize = 20;
  for (let i = 0; i < usersToAdd.length; i += chunkSize) {
    const chunk = usersToAdd.slice(i, i + chunkSize);
    try {
      await axios.patch(
        `${GRAPH_URL}/groups/${usersGroupId}`,
        {
          "members@odata.bind": chunk.map(
            (u) => `${GRAPH_URL}/directoryObjects/${u.id}`,
          ),
        },
        { headers, timeout: 15000 },
      );
      console.log(
        `[POST-CONSENT] Users chunk added: ${i + 1}–${Math.min(i + chunkSize, usersToAdd.length)} of ${usersToAdd.length}`,
      );
    } catch (err) {
      console.warn(
        `[POST-CONSENT] Chunk ${i} failed:`,
        err.response?.data?.error?.message ?? err.message,
      );
    }
  }
};

// ─── Flow 4: Assign Groups to App Roles ──────────────────────────────────────
const assignGroupsToAppRoles = async (headers, adminGroupId, usersGroupId) => {
  const spRes = await axios.get(
    `${GRAPH_URL}/servicePrincipals?$filter=appId eq '${process.env.AZURE_CLIENT_ID}'&$select=id,appId,displayName,appRoles`,
    { headers, timeout: 10000 },
  );
  const sp = spRes.data.value?.[0];
  if (!sp)
    throw new Error("Service principal not found for app role assignment");

  const assignGroupRole = async (groupId, appRoleId, label) => {
    const existingRes = await axios.get(
      `${GRAPH_URL}/groups/${groupId}/appRoleAssignments`,
      { headers, timeout: 10000 },
    );
    const alreadyAssigned = existingRes.data.value?.some(
      (a) => a.resourceId === sp.id && a.appRoleId === appRoleId,
    );

    if (alreadyAssigned) {
      console.log(
        `[POST-CONSENT] ${label} already assigned to appRole ${appRoleId}`,
      );
      return;
    }

    await axios.post(
      `${GRAPH_URL}/groups/${groupId}/appRoleAssignments`,
      {
        principalId: groupId,
        resourceId: sp.id,
        appRoleId,
      },
      { headers, timeout: 10000 },
    );
    console.log(`[POST-CONSENT] Assigned ${label} → appRole ${appRoleId}`);
  };

  await Promise.allSettled([
    assignGroupRole(adminGroupId, ADMIN_APP_ROLE_ID, "PowerIntake.Admin"),
    assignGroupRole(usersGroupId, USERS_APP_ROLE_ID, "PowerIntake.Users"),
  ]);
};

// ─── Flow 5: Persist Group IDs to DB ─────────────────────────────────────────
const persistGroupIdsToDb = async (tenantUuid, adminGroupId, usersGroupId) => {
  await client.query(`SELECT public.tenant_update_groups($1, $2, $3)`, [
    tenantUuid,
    adminGroupId,
    usersGroupId,
  ]);
  console.log(
    `[POST-CONSENT] Persisted group IDs to DB — admin: ${adminGroupId}, users: ${usersGroupId}`,
  );
};

// ─── Master Post-Consent Flow ─────────────────────────────────────────────────
const runPostConsentFlow = async ({ token, tenant, adminOid, tenantUuid }) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // Flow 1 — Ensure groups exist (create or retrieve IDs)
    const { adminGroupId, usersGroupId } = await ensureGroups(headers);

    // Flow 2 — Assign Global Admin to both groups
    await assignAdminToGroups(headers, adminOid, adminGroupId, usersGroupId);

    // Flow 3 — Batch assign all tenant users to PowerIntake.Users
    await batchAssignUsersToGroup(headers, usersGroupId);

    // Flow 4 — Assign groups to their respective app roles
    await assignGroupsToAppRoles(headers, adminGroupId, usersGroupId);

    // Flow 5 — Persist group IDs into DB using focused function
    await persistGroupIdsToDb(tenantUuid, adminGroupId, usersGroupId);

    console.log(
      "[POST-CONSENT] ✅ Full post-consent flow completed successfully",
    );
  } catch (err) {
    console.error("[POST-CONSENT] ❌ Post-consent flow error:", err.message);
  }
};

// ─── Consent Callback ─────────────────────────────────────────────────────────
const consent_Callback = async (req, res) => {
  const { tenant, admin_consent, error } = req.query;
  const adminOid = req.user?.oid || req.user?.sub;

  if (error || admin_consent !== "True") {
    console.warn("[CONSENT] Failed or cancelled:", { tenant, error, admin_consent });
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }

  if (!tenant) {
    console.error("[CONSENT] Missing tenant in callback");
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }

  if (!adminOid) {
    console.error("[CONSENT] Missing admin OID from token — is validateToken applied to this route?");
    return res.json({ redirectUrl: "/consent-callback?consent=failed" });
  }

  try {
    const token = await getAccessToken(tenant);
    const headers = { Authorization: `Bearer ${token}` };

    // ── Fetch org info ──────────────────────────────────────────────────────
    const orgRes = await axios.get(`${GRAPH_URL}/organization`, { headers });
    const org = orgRes.data.value?.[0];
    const tenantName = org?.displayName ?? "Unknown";
    const tenantDomain =
      org?.verifiedDomains?.find((d) => d.isDefault)?.name ?? null;

    // ── Grant Graph permissions (non-blocking) ──────────────────────────────
    try {
      await grantGraphPermissions(token);
    } catch (grantErr) {
      console.warn("[CONSENT] Could not auto-grant Graph permissions:", grantErr.message);
    }

    // ── Update isconsented in DB ────────────────────────────────────────────
    const consentResult = await client.query(
      `SELECT * FROM public.tenant_update_isconsented($1, $2)`,
      [tenant, true],
    );
    const updateRow = consentResult.rows[0];

    if (!updateRow?.updated) {
      console.error(
        `[CONSENT] ❌ Tenant not found in DB — tenant=${tenant} name=${tenantName}`,
      );
      return res.json({ redirectUrl: "/consent-callback?consent=failed" });
    }

    // ── Resolve tenantuuid (isolated — never blocks the redirect) ───────────
    let tenantUuid = null;
    try {
      const tenantRow = await client.query(
        `SELECT tenantuuid
         FROM public.tenant_get_map_with_entratenantid()
         WHERE entratenantid = $1`,
        [tenant],
      );
      tenantUuid = tenantRow.rows[0]?.tenantuuid ?? null;

      if (!tenantUuid) {
        console.warn(
          `[CONSENT] ⚠️ Could not resolve tenantuuid for entratenantid=${tenant}`,
        );
      }
    } catch (uuidErr) {
      // Never let this block the redirect
      console.error("[CONSENT] ❌ Failed to fetch tenantuuid:", uuidErr.message, uuidErr.stack);
    }

    console.log("[CONSENT] ✅ Admin approval received:");
    console.log(`  Tenant ID   : ${tenant}`);
    console.log(`  Tenant Name : ${tenantName}`);
    console.log(`  Domain      : ${tenantDomain}`);
    console.log(`  Admin OID   : ${adminOid}`);
    console.log(`  Tenant UUID : ${tenantUuid ?? "not resolved"}`);
    console.log(`  DB updated  : ${updateRow.updated}`);
    console.log(`  Timestamp   : ${new Date().toISOString()}`);

    // ── Respond immediately — never block on provisioning ───────────────────
    res.json({ redirectUrl: "/consent-callback?consent=success" });

    // ── Fire-and-forget post-consent provisioning ───────────────────────────
    if (tenantUuid) {
      runPostConsentFlow({ token, tenant, adminOid, tenantUuid });
    } else {
      console.warn(
        "[CONSENT] ⚠️ Skipping post-consent flow — tenantUuid could not be resolved",
      );
    }
  } catch (err) {
    console.error("[CONSENT] Callback error:", err.message, err.stack);
    // Guard against double-send if res was already flushed
    if (!res.headersSent) {
      return res.json({ redirectUrl: "/consent-callback?consent=failed" });
    }
  }
};

module.exports = { consent_Callback };