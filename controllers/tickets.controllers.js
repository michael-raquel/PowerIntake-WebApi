const client = require("../config/db");
const axios = require("axios");
const { getAccessToken } = require('../config/authService');
const GRAPH_URL = "https://graph.microsoft.com/v1.0"; 
const { getDynamicsToken } = require("../utils/dynamicsToken");
const { cleanDescription, dynamicsHeaders, resolveTechnicianNames } = require("../utils/dynamicsHelpers");
const { INCIDENT_SELECT_FIELDS, INCIDENT_EXPAND_FIELDS } = require("../utils/dynamicsFields");

const { mapTicket } = require("../utils/dynamicsMapTicket");

const get_Ticket = async (req, res) => {
    try {
        const { ticketuuid, entrauserid, entratenantid } = req.query;

        const result = await client.query(
            "SELECT * FROM ticket_get($1, $2, $3)",
            [ticketuuid || null, entrauserid || null, entratenantid || null]
        );

        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const get_Ticket_Status = async (req, res) => {
    try {

        const { ticketuuid } = req.query;

        const result = await client.query(
            "SELECT * FROM ticketstatus_get($1)",
            [ticketuuid || null]
        );
     
        res.status(200).json(result.rows);

    } catch (err) {
      
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const get_ManagerTeamTickets = async (req, res) => {
  try {
    const { managerid } = req.query;

    const directReportsResponse = await axios.get(
      `${GRAPH_URL}/users/${managerid}/directReports`,
      { headers: { Authorization: `Bearer ${await getAccessToken()}` } }
    );

    const directReports = directReportsResponse.data.value;

    const ticketResults = await Promise.all(
      directReports.map(async (user) => {
        const result = await client.query(
          "SELECT * FROM ticket_get($1, $2)",
          [null, user.id]
        );
        return {
          user: user.displayName,
          entrauserid: user.id,
          tickets: result.rows,
        };
      })
    );

    res.status(200).json({
      manager: managerid,
      team: ticketResults,
    });

  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};

const get_ManagerTickets = async (req, res) => {
    try {
        const { managerentrauserid, status } = req.query;

        if (!managerentrauserid) {
            return res.status(400).json({ error: "managerentrauserid is required" });
        }

        const result = await client.query(
            "SELECT * FROM ticket_manager_get($1, $2)",
            [managerentrauserid, status || null]
        );

        return res.status(200).json(result.rows);

    } catch (err) {
        if (err.message) {
            return res.status(400).json({ error: err.message });
        }

        return res.status(500).json({ error: "Internal Server Error" });
    }
};
 
const update_Ticket = async (req, res) => {
    try {
        const {
            ticketuuid,
            title,
            description,
            usertimezone,
            officelocation,
            date,
            starttime,
            endtime,
            modifiedby,
        } = req.body;
 
        const toArray = (val) => Array.isArray(val) ? val : val ? [val] : [];
 
        const result = await client.query(
            "SELECT * FROM ticket_update($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [
                ticketuuid,
                title,
                description,
                usertimezone,
                officelocation,
                toArray(date),
                toArray(starttime),
                toArray(endtime),
                modifiedby
            ]
        );
 
        res.status(200).json(result.rows[0]);
    } catch (err) {
 
        if (err.message) {
            return res.status(400).json({ error: err.message });
        }
 
        res.status(500).json({ error: "Internal Server Error" });
    }
};


const get_DynamicsTickets = async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: "startDate and endDate are required" });
        }

        const token = await getDynamicsToken();

        const start = `${startDate}T00:00:00Z`;
        const end   = `${endDate}T23:59:59Z`;

        let filter = `createdon ge ${start} and createdon le ${end}`;
        if (status !== undefined) {
            filter += ` and statecode eq ${parseInt(status, 10)}`;
        }

        const response = await axios.get(
            `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents?$select=${INCIDENT_SELECT_FIELDS}&$expand=${INCIDENT_EXPAND_FIELDS}&$filter=${encodeURIComponent(filter)}`,
            { headers: dynamicsHeaders(token) }
        );

        const rawTickets = response.data.value;

        const technicianMap = await resolveTechnicianNames(rawTickets, token);

        const tickets = rawTickets.map(ticket =>
            mapTicket(ticket, technicianMap[ticket._ss_assignedtechnician_value] ?? null)
            
        );

        return res.status(200).json({ tickets, count: tickets.length });
        
    } catch (err) {
        return res.status(500).json({
            error:   "Failed to fetch tickets from Dynamics",
            details: err.response?.data || err.message,
        });
    }
};

const get_DynamicsTicketById = async (req, res) => {
    try {
        const { ticketnumber } = req.params;

        if (!ticketnumber) {
            return res.status(400).json({ error: "ticketnumber is required" });
        }

        const token = await getDynamicsToken();

        const response = await axios.get(
            `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents?$filter=ticketnumber eq '${ticketnumber}'&$select=${INCIDENT_SELECT_FIELDS}&$expand=${INCIDENT_EXPAND_FIELDS}`,
            { headers: dynamicsHeaders(token) }
        );

        const ticket = response.data.value?.[0];
        if (!ticket) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        let technicianname = null;
        if (ticket._ss_assignedtechnician_value) {
            try {
                const techRes = await axios.get(
                    `${process.env.DYNAMICS_URL}/api/data/v9.2/systemusers(${ticket._ss_assignedtechnician_value})?$select=fullname`,
                    { headers: dynamicsHeaders(token) }
                );
                technicianname = techRes.data.fullname ?? null;
            } catch {}
        }

        return res.status(200).json(mapTicket(ticket, technicianname));

    } catch (err) {
        return res.status(500).json({
            error:   "Failed to fetch ticket from Dynamics",
            details: err.response?.data || err.message,
        });
    }
};

const formatTime = (time) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour   = h % 12 || 12;
    return m === 0 ? `${hour}${period}` : `${hour}:${m.toString().padStart(2, '0')}${period}`;
};

const getUTCOffset = (timezone) => {
    try {
        const formatter = new Intl.DateTimeFormat('en', {
            timeZone:     timezone,
            timeZoneName: 'longOffset',
            hour:         'numeric',
        });
        const parts     = formatter.formatToParts(new Date());
        const offsetPart = parts.find(p => p.type === 'timeZoneName');
        return offsetPart ? offsetPart.value.replace('GMT', 'UTC') : '';
    } catch (e) {
        return '';
    }
};

const buildDescriptionWithSchedule = (description, dates, startTimes, endTimes, timezone) => {
    const offset     = getUTCOffset(timezone);          
    const tzLabel    = offset ? `${timezone} (${offset})` : timezone;

    const scheduleLines = dates.map((date, i) => {
        const d       = new Date(date);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
        return `${dateStr} ${formatTime(startTimes[i])} to ${formatTime(endTimes[i])}`;
    });

    const scheduleSuffix = [
        '',
        '',
        'Available Date and Time for Support Call:',
        `Time zone: ${tzLabel}`,
        ...scheduleLines,
    ].join('\n');

    return `${description}${scheduleSuffix}`;
};

const create_Ticket = async (req, res) => {
    try {
        const {
            entrauserid, entratenantid, title, description,
            date, starttime, endtime, usertimezone, officelocation,
            attachments, createdby, contactid,
        } = req.body;

        const toArray = (val) => Array.isArray(val) ? val : val ? [val] : [];

        const dates      = toArray(date);
        const startTimes = toArray(starttime);
        const endTimes   = toArray(endtime);

        const fullDescription = buildDescriptionWithSchedule(
            description,
            dates,
            startTimes,
            endTimes,
            usertimezone
        );

        const [result, token, tenantResult, userResult] = await Promise.all([
            client.query(
                "SELECT * FROM ticket_create($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
                [
                    entrauserid, entratenantid, title, fullDescription,  
                    dates, startTimes, endTimes,
                    usertimezone, officelocation, toArray(attachments), createdby,
                ]
            ),
            getDynamicsToken(),
            client.query(
                "SELECT public.tenant_get_dynamicsaccountid($1) AS dynamicsaccountid",
                [entratenantid]
            ),
            client.query(
                "SELECT * FROM public.user_get_info($1)",
                [entrauserid]
            ),
        ]);

        const { ticketuuid, ticketnumber } = result.rows[0];
        const dynamicsAccountId = tenantResult.rows[0]?.dynamicsaccountid ?? null;
        const userInfo          = userResult.rows[0] ?? {};

        res.status(201).json({ ticketuuid, ticketnumber, dynamicsIncidentId: null });

        syncToDynamics({
            token, ticketuuid, dynamicsAccountId,
            userInfo,
            title,
            description: fullDescription,  
            usertimezone,
            date: dates,
            starttime: startTimes,
            endtime: endTimes,
            contactid,
        }).catch(err => console.error("Background Dynamics sync failed:", err.message));

    } catch (err) {
        if (err.message) return res.status(400).json({ error: err.message });
        res.status(500).json({ error: "Internal Server Error" });
    }
};

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

const syncToDynamics = async ({
    token, ticketuuid, dynamicsAccountId,
    userInfo, 
    title, description, usertimezone,
    date, starttime, endtime, contactid,
}) => {
    const toArray = (val) => Array.isArray(val) ? val : val ? [val] : [];

    const dynamicsPayload = {
        "title":             title,
        "description":       description,
        "ss_ticketcategory": 128,
        "ss_source":         19,
        "ss_timezone":       usertimezone ?? null,
    };

    const dates  = toArray(date);
    const starts = toArray(starttime);
    const ends   = toArray(endtime);
    if (dates.length > 0) {
        dynamicsPayload["ss_schedulestartdate"] = `${dates[0]}T${starts[0]}:00Z`;
        dynamicsPayload["ss_scheduleenddate"]   = `${dates[dates.length - 1]}T${ends[ends.length - 1]}:00Z`;
    }

    if (dynamicsAccountId) {
        dynamicsPayload["customerid_account@odata.bind"] = `/accounts(${dynamicsAccountId})`;
    }

    try {
        const ownerRes = await axios.get(
            `${process.env.DYNAMICS_URL}/api/data/v9.2/systemusers?$filter=internalemailaddress eq 'Joseph@SpartaServ.com'&$select=systemuserid`,
            {
                headers: {
                    Authorization:      `Bearer ${token}`,
                    Accept:             "application/json",
                    "OData-Version":    "4.0",
                    "OData-MaxVersion": "4.0",
                }
            }
        );
        const ownerId = ownerRes.data.value?.[0]?.systemuserid ?? null;
        if (ownerId) {
            dynamicsPayload["ownerid@odata.bind"] = `/systemusers(${ownerId})`;
            console.log("Owner resolved:", ownerId);
        } else {
            console.warn("Owner not found for Joseph@SpartaServ.com");
        }
    } catch (ownerErr) {
        console.error("Failed to resolve owner:", ownerErr.response?.data || ownerErr.message);
    }

    if (contactid) {
        dynamicsPayload["ss_Contact@odata.bind"] = `/contacts(${contactid})`;
    } else if (userInfo?.useremail) {
        try {
            const contactRes = await axios.get(
                `${process.env.DYNAMICS_URL}/api/data/v9.2/contacts?$filter=emailaddress1 eq '${userInfo.useremail}'&$select=contactid`,
                {
                    headers: {
                        Authorization:      `Bearer ${token}`,
                        Accept:             "application/json",
                        "OData-Version":    "4.0",
                        "OData-MaxVersion": "4.0",
                    }
                }
            );

            let dynamicsContactId = contactRes.data.value?.[0]?.contactid ?? null;

            if (!dynamicsContactId) {
                console.warn(`No Dynamics contact found for ${userInfo.useremail} — creating...`);

                const nameParts = (userInfo.username ?? "").trim().split(/\s+/);
                const firstname = nameParts.length > 1 ? nameParts[0] : null;
                const lastname  = nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0] ?? userInfo.useremail;

                const createContactRes = await axios.post(
                    `${process.env.DYNAMICS_URL}/api/data/v9.2/contacts`,
                    {
                        emailaddress1: userInfo.useremail,
                        firstname:     firstname,
                        lastname:      lastname,
                        jobtitle:      userInfo.jobtitle      ?? null,
                        telephone1:    userInfo.businessphone ?? null,
                        mobilephone:   userInfo.mobilephone   ?? null,
                        department:    userInfo.department    ?? null,
                        ...(dynamicsAccountId && {
                            "parentcustomerid_account@odata.bind": `/accounts(${dynamicsAccountId})`
                        }),
                    },
                    {
                        headers: {
                            Authorization:      `Bearer ${token}`,
                            Accept:             "application/json",
                            "Content-Type":     "application/json",
                            "OData-Version":    "4.0",
                            "OData-MaxVersion": "4.0",
                            "Prefer":           "return=representation",
                        }
                    }
                );

                dynamicsContactId = createContactRes.data?.contactid ?? null;
                console.log("Contact created in Dynamics:", dynamicsContactId);
            }

            if (dynamicsContactId) {
                dynamicsPayload["ss_Contact@odata.bind"] = `/contacts(${dynamicsContactId})`;
            }

        } catch (contactErr) {
            console.error("Failed to resolve/create Dynamics contact:", contactErr.response?.data || contactErr.message);
        }
    }

    const dynamicsRes = await axios.post(
        `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents`,
        dynamicsPayload,
        {
            headers: {
                Authorization:      `Bearer ${token}`,
                Accept:             "application/json",
                "Content-Type":     "application/json",
                "OData-Version":    "4.0",
                "OData-MaxVersion": "4.0",
                "Prefer":           "return=representation",
            }
        }
    );

    const dynamicsIncidentId   = dynamicsRes.data?.incidentid  ?? null;
    const dynamicsTicketNumber = dynamicsRes.data?.ticketnumber ?? null;
    const statusCode           = dynamicsRes.data?.statuscode   ?? null;
    const dynamicsStatus       = DYNAMICS_STATUSCODE_MAP[statusCode] ?? "New";

    console.log("Dynamics incident created:", { dynamicsIncidentId, dynamicsTicketNumber, dynamicsStatus });

    if (dynamicsIncidentId) {
        await client.query(
            "SELECT public.ticket_update_dynamics($1, $2, $3, $4)",
            [ticketuuid, dynamicsIncidentId, dynamicsTicketNumber, dynamicsStatus]
        );
    }
};

const buildAccountMap = (filtered) => {
    const accountMap = new Map();

    for (const t of filtered) {
        const accId = t._customerid_value;
        if (!accId || accountMap.has(accId)) continue;

        accountMap.set(accId, {
            name: t["_customerid_value@OData.Community.Display.V1.FormattedValue"] || "Unknown Company",
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
            username:      contact.fullname
                           ?? `${contact.firstname ?? ""} ${contact.lastname ?? ""}`.trim()
                           ?? null,
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

const db_batchUpsertUsers = async (contactMap) => {
    if (contactMap.size === 0) return;

    const existingEmails = await db_getExistingUserEmails([...contactMap.keys()]);
    const newContacts = [...contactMap.entries()].filter(
        ([email]) => !existingEmails.has(email)  
    );

    if (newContacts.length === 0) {
        console.log("No new users to insert.");
        return;
    }

    const emails         = newContacts.map(([email])  => email);
    const usernames      = newContacts.map(([, c])    => c.username      ?? null);
    const jobtitles      = newContacts.map(([, c])    => c.jobtitle      ?? null);
    const businessphones = newContacts.map(([, c])    => c.businessphone ?? null);
    const mobilephones   = newContacts.map(([, c])    => c.mobilephone   ?? null);
    const departments    = newContacts.map(([, c])    => c.department    ?? null);
    const userroles      = newContacts.map(()         => "user");

    try {
        await client.query(`SELECT public.batch_user_insert($1, $2, $3, $4, $5, $6, $7)`, [emails, usernames, jobtitles, businessphones, mobilephones, departments, userroles]);
      

    } catch (e) {
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

const db_loadTenantMap = async () => {
    try {
        const result = await client.query(`SELECT * FROM public.tenant_get_map()`);
        return Object.fromEntries(
            result.rows
                .filter(r => r.dynamicsaccountid != null)
                .map(r => [r.dynamicsaccountid, r.tenantid])
        );
    } catch (e) {
        throw e;
    }
};

const db_loadUserMap = async () => {
    try {
        const result = await client.query(`SELECT * FROM public.user_get_map()`);
        return Object.fromEntries(
            result.rows
                .filter(r => r.useremail != null)
                .map(r => [r.useremail, r.userid])  
        );
    } catch (e) {
        console.error("db_loadUserMap failed:", e.message);
        throw e;
    }
};

const db_syncTicket = async (ticket, tenantid, userid, technicianname) => {
    const statusCode   = ticket.statuscode ?? null;
    const statusLabel  = DYNAMICS_STATUSCODE_MAP[statusCode]
                      ?? ticket["ss_autotaskticketstatus@OData.Community.Display.V1.FormattedValue"]
                      ?? null;

    await client.query(
        `SELECT * FROM public.ticket_sync_dynamics(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
            $31,$32,$33,$34,$35,$36
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
            ticket.ss_ticketstage                                                                           ?? null,
            ticket.ss_customerconfirmation                                                                  ?? null,
            ticket["ss_ticketcategory@OData.Community.Display.V1.FormattedValue"]                           ?? null,
            ticket["ss_tickettype@OData.Community.Display.V1.FormattedValue"]                               ?? null,
            ticket["prioritycode@OData.Community.Display.V1.FormattedValue"]                                ?? null,
            statusLabel,       
            ticket.ss_quickfixflag                                                                          ?? null,
            ticket.ss_reason                                                                                ?? null,
            ticket.ss_completedonautotask                                                                   ?? null,
        ]
    );
};

const sync_DynamicsTickets_toDB = async (req, res) => {
    try {
        const token           = await getDynamicsToken();
        const ALLOWED_SOURCES = [1, 2, 3, 4, 19];

        const start  = "2026-01-01T00:00:00Z";
        const end    = new Date().toISOString();
        const filter = `createdon ge ${start} and createdon le ${end}`;

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

        console.log("Tenant map keys:", Object.keys(tenantMap).slice(0, 3));
        console.log("Sample ticket _customerid_value:", filtered[0]._customerid_value);

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

module.exports = {
    get_Ticket,
    update_Ticket,
    get_Ticket_Status,
    get_ManagerTeamTickets,
    get_ManagerTickets,
    get_DynamicsTickets,
    get_DynamicsTicketById,
    create_Ticket,
    sync_DynamicsTickets_toDB
};