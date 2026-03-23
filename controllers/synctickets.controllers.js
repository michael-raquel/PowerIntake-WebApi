const client = require("../config/db");
const axios = require("axios");
const { getDynamicsToken } = require("../utils/dynamicsToken");
const { cleanDescription, resolveTechnicianNames } = require("../utils/dynamicsHelpers");
const { INCIDENT_SELECT_FIELDS, INCIDENT_EXPAND_FIELDS } = require("../utils/dynamicsFields");

const ALLOWED_SOURCES = [18, 2, 4, 17, 19];

const DYNAMICS_STATUSCODE_MAP = {
    1:         "Working Issue Now",
    2:         "Waiting",
    3:         "Work Completed",
    4:         "Reschedule",
    5:         "Problem Solved",
    6:         "Cancelled",
    1000:      "Information Provided",
    2000:      "Merged",
    196780001: "Assigned",
    196780002: "Technician Rejected",
    196780003: "Waiting Approval",
    196780004: "Client Responded",
    196780005: "Escalate To Onsite",
    196780006: "Pending Closure",
    196780007: "Scheduling Required",
    196780008: "New",
};


const buildAccountMap = (filtered) => {
    const accountMap = new Map();
    for (const t of filtered) {
        const accId = t._customerid_value;
        if (!accId || accountMap.has(accId)) continue;
        accountMap.set(accId, {
            name:          t["_customerid_value@OData.Community.Display.V1.FormattedValue"] || "Unknown Company",
            entraTenantId: t.ss_Contact?.parentcustomerid?.ss_entratenantid ?? null,
        });
    }
    return accountMap;
};

const buildContactMap = (filtered) => {
    const contactMap = new Map();
    for (const t of filtered) {
        const contact = t.ss_Contact;
        if (!contact) continue;
        const email = contact.emailaddress1;
        if (!email || contactMap.has(email)) continue;
        contactMap.set(email, {
            username:      contact.fullname ?? `${contact.firstname ?? ""} ${contact.lastname ?? ""}`.trim() ?? null,
            jobtitle:      contact.jobtitle    ?? null,
            businessphone: contact.telephone1  ?? null,
            mobilephone:   contact.mobilephone ?? null,
            department:    contact.department  ?? null,
        });
    }
    return contactMap;
};

const db_batchUpsertTenants = async (accountMap) => {
    const accountIds = Array.from(accountMap.keys());
    if (accountIds.length === 0) return;
    const names       = accountIds.map(id => accountMap.get(id).name);
    const dynamicsIds = accountIds;
    const entraIds    = accountIds.map(id => accountMap.get(id).entraTenantId ?? null);
    try {
        await client.query(`SELECT public.batch_tenant_insert($1, $2, $3)`, [names, dynamicsIds, entraIds]);
        console.log(`Batch upserted tenants: ${accountIds.length}`);
    } catch (e) {
        console.error("db_batchUpsertTenants failed:", e.message);
        throw e;
    }
};

const db_getExistingUserEmails = async (emails) => {
    try {
        const result = await client.query(`SELECT * FROM public.batch_email_check($1)`, [emails]);
        return new Set(result.rows.map(r => r.useremail));
    } catch (e) {
        console.error("db_getExistingUserEmails failed:", e.message);
        throw e;
    }
};

const db_batchUpsertUsers = async (contactMap) => {
    if (contactMap.size === 0) return;
    const existingEmails = await db_getExistingUserEmails([...contactMap.keys()]);
    const newContacts    = [...contactMap.entries()].filter(([email]) => !existingEmails.has(email));
    if (newContacts.length === 0) { console.log("No new users to insert."); return; }
    const emails         = newContacts.map(([email])  => email);
    const usernames      = newContacts.map(([, c])    => c.username      ?? null);
    const jobtitles      = newContacts.map(([, c])    => c.jobtitle      ?? null);
    const businessphones = newContacts.map(([, c])    => c.businessphone ?? null);
    const mobilephones   = newContacts.map(([, c])    => c.mobilephone   ?? null);
    const departments    = newContacts.map(([, c])    => c.department    ?? null);
    const userroles      = newContacts.map(()         => "user");
    try {
        await client.query(`SELECT public.batch_user_insert($1, $2, $3, $4, $5, $6, $7)`, [emails, usernames, jobtitles, businessphones, mobilephones, departments, userroles]);
    } catch (e) { throw e; }
};

const db_loadTenantMap = async () => {
    try {
        const result = await client.query(`SELECT * FROM public.tenant_get_map()`);
        return Object.fromEntries(
            result.rows.filter(r => r.dynamicsaccountid != null).map(r => [r.dynamicsaccountid, r.tenantid])
        );
    } catch (e) { throw e; }
};

const db_loadUserMap = async () => {
    try {
        const result = await client.query(`SELECT * FROM public.user_get_map()`);
        return Object.fromEntries(
            result.rows.filter(r => r.useremail != null).map(r => [r.useremail, r.userid])
        );
    } catch (e) {
        console.error("db_loadUserMap failed:", e.message);
        throw e;
    }
};

const db_syncTicket = async (ticket, tenantid, userid, technicianname) => {
    const statusCode  = ticket.statuscode ?? null;
    const statusLabel = DYNAMICS_STATUSCODE_MAP[statusCode]
                     ?? ticket["ss_autotaskticketstatus@OData.Community.Display.V1.FormattedValue"]
                     ?? null;

    await client.query(
        `SELECT * FROM public.ticket_sync_dynamics(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
            $31,$32,$33,$34,$35,$36,$37
        )`,
        [
            ticket.incidentid,
            tenantid,
            userid,
            ticket.title                                                                                    ?? null,
            cleanDescription(ticket.description),
            ticket.ss_timezone                                                                              ?? null,
            ticket.createdon,
            ticket.ticketnumber                                                                             ?? null,
            ticket._ss_assignedtechnician_value                                                             ?? null,
            technicianname,
            ticket.ss_timezone                                                                              ?? null,
            ticket.ss_schedulestartdate                                                                     ?? null,
            ticket.ss_scheduleenddate                                                                       ?? null,
            ticket.ss_scheduletype                                                                          ?? null,
            ticket["_ss_autotaskissuetype_value@OData.Community.Display.V1.FormattedValue"]                 ?? null,
            ticket["_ss_autotasksubissuetype_value@OData.Community.Display.V1.FormattedValue"]              ?? null,
            ticket.ss_skillrequired                                                                         ?? null,
            ticket["ss_worktype@OData.Community.Display.V1.FormattedValue"]                                 ?? null,
            ticket.ss_duedate                                                                               ?? null,
            ticket["ss_ticketurgency@OData.Community.Display.V1.FormattedValue"] ?? ticket.ss_ticketurgency ?? null,
            ticket.ss_ticketimpact                                                                          ?? null,
            ticket["ss_source@OData.Community.Display.V1.FormattedValue"]                                   ?? null,
            ticket.ss_estimatedhours                                                                        ?? null,
            ticket.ss_actualhours                                                                           ?? null,
            ticket["_slainvokedid_value@OData.Community.Display.V1.FormattedValue"]                         ?? null,
            ticket.ss_requesttype                                                                           ?? null,
            ticket["_ss_contract_value@OData.Community.Display.V1.FormattedValue"]                          ?? null,
            ticket["ss_ticketstage@OData.Community.Display.V1.FormattedValue"]                              ?? null,
            ticket.ss_customerconfirmation                                                                  ?? null,
            ticket["ss_ticketcategory@OData.Community.Display.V1.FormattedValue"]                           ?? null,
            ticket["ss_tickettype@OData.Community.Display.V1.FormattedValue"]                               ?? null,
            ticket["prioritycode@OData.Community.Display.V1.FormattedValue"]                                ?? null,
            statusLabel,
            ticket.ss_quickfixflag                                                                          ?? null,
            ticket.ss_reason                                                                                ?? null,
            ticket.ss_completedonautotask                                                                   ?? null,
            ticket.modifiedon                                                                               ?? null,
        ]
    );
};

const db_deleteMissingTickets = async (dynamicsIncidentIds, from = null, to = null) => {
    if (dynamicsIncidentIds.length === 0) return;
    try {
        await client.query(`SELECT public.ticket_missing_delete($1, $2, $3)`, [dynamicsIncidentIds, from, to]);
        console.log(`[SYNC] Missing tickets deleted.`);
    } catch (e) {
        console.error("db_deleteMissingTickets failed:", e.message);
        throw e;
    }
};


const fetchDynamicsTickets = async (token, filter) => {
    let allTickets = [];
    let nextLink   = `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents?$select=${INCIDENT_SELECT_FIELDS}&$expand=${INCIDENT_EXPAND_FIELDS}&$filter=${encodeURIComponent(filter)}&$top=1000`;

    while (nextLink) {
        const response = await axios.get(nextLink, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept:             "application/json",
                "OData-Version":    "4.0",
                "OData-MaxVersion": "4.0",
                Prefer: "odata.include-annotations=OData.Community.Display.V1.FormattedValue,odata.maxpagesize=1000",
            },
        });
        allTickets.push(...response.data.value);
        nextLink = response.data["@odata.nextLink"] ?? null;
    }

    return allTickets;
};

const processSyncTickets = async (tickets, tenantMap, userMap, technicianMap) => {
    let synced  = 0;
    let skipped = 0;
    const errors = [];

    for (const ticket of tickets) {
        try {
            const tenantid = tenantMap[ticket._customerid_value] ?? null;
            if (!tenantid) {
                console.warn(`No tenant for ${ticket.ticketnumber}`);
                skipped++;
                continue;
            }
            const contactEmail   = ticket.ss_Contact?.emailaddress1 ?? null;
            const userid         = contactEmail ? (userMap[contactEmail] ?? null) : null;
            const technicianname = technicianMap[ticket._ss_assignedtechnician_value] ?? null;

            await db_syncTicket(ticket, tenantid, userid, technicianname);
            synced++;
        } catch (ticketErr) {
            console.error(`Failed to sync ${ticket.ticketnumber}:`, ticketErr.message);
            errors.push({ ticketnumber: ticket.ticketnumber, error: ticketErr.message });
            skipped++;
        }
    }

    return { synced, skipped, errors };
};


const sync_DynamicsTickets_byClients = async (req, res) => {
    try {
        const token           = await getDynamicsToken();
        const ALLOWED_SOURCES = [18, 2, 4, 17, 19];

       const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const filter = `modifiedon ge ${start.toISOString()} and modifiedon le ${end.toISOString()}`;
        // const filter = `modifiedon ge ${start.toISOString()}`;

        console.log(`Cron mode: AUTOMATIC (modified from ${start.toISOString()} to ${end.toISOString()})`);

        let allTickets = [];
        let nextLink   = `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents?$select=${INCIDENT_SELECT_FIELDS}&$expand=${INCIDENT_EXPAND_FIELDS}&$filter=${encodeURIComponent(filter)}&$top=1000`;

        while (nextLink) {
            const response = await axios.get(nextLink, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "OData-Version": "4.0",
                    "OData-MaxVersion": "4.0",
                    Prefer: "odata.include-annotations=OData.Community.Display.V1.FormattedValue,odata.maxpagesize=1000",
                },
            });
            allTickets.push(...response.data.value);
            nextLink = response.data["@odata.nextLink"] ?? null;
        }

        console.log(`Fetched ${allTickets.length} tickets from Dynamics`);

        const filtered = allTickets.filter(t => ALLOWED_SOURCES.includes(t.ss_source));
        console.log(`Filtered to ${filtered.length} tickets`);

        if (filtered.length === 0) {
            return res.status(200).json({ message: "No eligible tickets found.", synced: 0 });
        }

        await db_batchUpsertTenants(buildAccountMap(filtered));
        const tenantMap = await db_loadTenantMap();

        await db_batchUpsertUsers(buildContactMap(filtered));
        const userMap = await db_loadUserMap();

        const technicianMap = await resolveTechnicianNames(filtered, token);

        let synced  = 0;
        let skipped = 0;
        const errors = [];

        for (const ticket of filtered) {
            try {
                const tenantid = tenantMap[ticket._customerid_value] ?? null;

                if (!tenantid) {
                    console.warn(`No tenant for ${ticket.ticketnumber}`);
                    skipped++;
                    continue;
                }

                const contactEmail   = ticket.ss_Contact?.emailaddress1 ?? null;
                const userid         = contactEmail ? (userMap[contactEmail] ?? null) : null;
                const technicianname = technicianMap[ticket._ss_assignedtechnician_value] ?? null;

                await db_syncTicket(ticket, tenantid, userid, technicianname);
                synced++;

            } catch (ticketErr) {
                console.error(`Failed to sync ${ticket.ticketnumber}:`, ticketErr.message);
                errors.push({ ticketnumber: ticket.ticketnumber, error: ticketErr.message });
                skipped++;
            }
        }

        // const dynamicsIds = allTickets.map(t => t.incidentid); 
        // await db_deleteMissingTickets(dynamicsIds);

        return res.status(200).json({
            message:  "Dynamics ticket sync completed.",
            total:    allTickets.length,
            filtered: filtered.length,
            synced,
            skipped,
            ...(errors.length > 0 && { errors }),
        });

    } catch (err) {
        console.error("sync_DynamicsTickets error:", err.message);
        return res.status(500).json({
            error:   "Failed to sync tickets from Dynamics",
            details: err.response?.data || err.message,
        });
    }
};

const sync_DynamicsTickets_byCompany = async (req, res) => {
    try {
        const { tenantid } = req.query;
        if (!tenantid) return res.status(400).json({ error: "tenantid is required" });

        const token  = await getDynamicsToken();
        const start  = new Date(); start.setHours(0, 0, 0, 0);
        const end    = new Date(); end.setHours(23, 59, 59, 999);
        const filter = `modifiedon ge ${start.toISOString()} and modifiedon le ${end.toISOString()}`;

        console.log(`[SYNC] BY COMPANY (tenantid: ${tenantid})`);

        const allTickets = await fetchDynamicsTickets(token, filter);
        console.log(`Fetched ${allTickets.length} tickets from Dynamics`);

        const filtered = allTickets.filter(t => ALLOWED_SOURCES.includes(t.ss_source));
        if (filtered.length === 0) return res.status(200).json({ message: "No eligible tickets found.", synced: 0 });

        await db_batchUpsertTenants(buildAccountMap(filtered));
        const tenantMap = await db_loadTenantMap();

        await db_batchUpsertUsers(buildContactMap(filtered));
        const userMap = await db_loadUserMap();

        const technicianMap = await resolveTechnicianNames(filtered, token);

        const companyTickets = filtered.filter(t => {
            const mappedTenantId = tenantMap[t._customerid_value];
            return mappedTenantId && mappedTenantId.toString() === tenantid.toString();
        });

        if (companyTickets.length === 0) return res.status(200).json({ message: "No tickets found for this company.", synced: 0 });

        const { synced, skipped, errors } = await processSyncTickets(companyTickets, tenantMap, userMap, technicianMap);

        return res.status(200).json({
            message:  "Company ticket sync completed.",
            total:    allTickets.length,
            filtered: companyTickets.length,
            synced,
            skipped,
            ...(errors.length > 0 && { errors }),
        });

    } catch (err) {
        console.error("sync_DynamicsTickets_byCompany error:", err.message);
        return res.status(500).json({ error: "Failed to sync tickets by company", details: err.response?.data || err.message });
    }
};

const sync_DynamicsTickets_byTeam = async (req, res) => {
    try {
        const { managerid } = req.query;
        if (!managerid) return res.status(400).json({ error: "managerid is required" });

        const token  = await getDynamicsToken();
        const start  = new Date(); start.setHours(0, 0, 0, 0);
        const end    = new Date(); end.setHours(23, 59, 59, 999);
        const filter = `modifiedon ge ${start.toISOString()} and modifiedon le ${end.toISOString()}`;

        console.log(`[SYNC] BY TEAM (managerid: ${managerid})`);

        const teamResult = await client.query(
            `SELECT userid FROM public.user WHERE managerid = (
                SELECT userid FROM public.user WHERE entrauserid = $1
            )`,
            [managerid]
        );
        const teamUserIds = teamResult.rows.map(r => r.userid);
        if (teamUserIds.length === 0) return res.status(200).json({ message: "No team members found for this manager.", synced: 0 });

        const allTickets = await fetchDynamicsTickets(token, filter);
        console.log(`Fetched ${allTickets.length} tickets from Dynamics`);

        const filtered = allTickets.filter(t => ALLOWED_SOURCES.includes(t.ss_source));
        if (filtered.length === 0) return res.status(200).json({ message: "No eligible tickets found.", synced: 0 });

        await db_batchUpsertTenants(buildAccountMap(filtered));
        const tenantMap = await db_loadTenantMap();

        await db_batchUpsertUsers(buildContactMap(filtered));
        const userMap = await db_loadUserMap();

        const technicianMap = await resolveTechnicianNames(filtered, token);

        const teamTickets = filtered.filter(t => {
            const contactEmail = t.ss_Contact?.emailaddress1 ?? null;
            const userid       = contactEmail ? (userMap[contactEmail] ?? null) : null;
            return userid && teamUserIds.includes(userid);
        });

        if (teamTickets.length === 0) return res.status(200).json({ message: "No tickets found for this team.", synced: 0 });

        const { synced, skipped, errors } = await processSyncTickets(teamTickets, tenantMap, userMap, technicianMap);

        return res.status(200).json({
            message:  "Team ticket sync completed.",
            total:    allTickets.length,
            filtered: teamTickets.length,
            synced,
            skipped,
            ...(errors.length > 0 && { errors }),
        });

    } catch (err) {
        console.error("sync_DynamicsTickets_byTeam error:", err.message);
        return res.status(500).json({ error: "Failed to sync tickets by team", details: err.response?.data || err.message });
    }
};

const sync_DynamicsTickets_byUser = async (req, res) => {
    try {
        const { entrauserid } = req.query;
        if (!entrauserid) return res.status(400).json({ error: "entrauserid is required" });

        const token  = await getDynamicsToken();
        const start  = new Date(); start.setHours(0, 0, 0, 0);
        const end    = new Date(); end.setHours(23, 59, 59, 999);
        const filter = `modifiedon ge ${start.toISOString()} and modifiedon le ${end.toISOString()}`;

        console.log(`[SYNC] BY USER (entrauserid: ${entrauserid})`);

        const userResult = await client.query(
            `SELECT userid, useremail FROM public.user WHERE entrauserid = $1`,
            [entrauserid]
        );
        if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found." });

        const { userid, useremail } = userResult.rows[0];

        const allTickets = await fetchDynamicsTickets(token, filter);
        console.log(`Fetched ${allTickets.length} tickets from Dynamics`);

        const filtered = allTickets.filter(t => ALLOWED_SOURCES.includes(t.ss_source));
        if (filtered.length === 0) return res.status(200).json({ message: "No eligible tickets found.", synced: 0 });

        await db_batchUpsertTenants(buildAccountMap(filtered));
        const tenantMap = await db_loadTenantMap();

        await db_batchUpsertUsers(buildContactMap(filtered));
        const userMap = await db_loadUserMap();

        const technicianMap = await resolveTechnicianNames(filtered, token);

        const userTickets = filtered.filter(t => {
            const contactEmail = t.ss_Contact?.emailaddress1 ?? null;
            return contactEmail && contactEmail.toLowerCase() === useremail.toLowerCase();
        });

        if (userTickets.length === 0) return res.status(200).json({ message: "No tickets found for this user.", synced: 0 });

        const { synced, skipped, errors } = await processSyncTickets(userTickets, tenantMap, userMap, technicianMap);

        return res.status(200).json({
            message:  "User ticket sync completed.",
            total:    allTickets.length,
            filtered: userTickets.length,
            synced,
            skipped,
            ...(errors.length > 0 && { errors }),
        });

    } catch (err) {
        console.error("sync_DynamicsTickets_byUser error:", err.message);
        return res.status(500).json({ error: "Failed to sync tickets by user", details: err.response?.data || err.message });
    }
};

module.exports = {
    sync_DynamicsTickets_byClients,
    sync_DynamicsTickets_byCompany,
    sync_DynamicsTickets_byTeam,
    sync_DynamicsTickets_byUser,
};