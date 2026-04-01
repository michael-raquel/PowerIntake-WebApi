const client = require("../config/db");
const axios = require("axios");
const { getAccessToken } = require('../config/authService');
const GRAPH_URL = "https://graph.microsoft.com/v1.0"; 
const { getDynamicsToken } = require("../utils/dynamicsToken");
const { cleanDescription, dynamicsHeaders, resolveTechnicianNames } = require("../utils/dynamicsHelpers");
const { INCIDENT_SELECT_FIELDS, INCIDENT_EXPAND_FIELDS } = require("../utils/dynamicsFields");
const { mapTicket } = require("../utils/dynamicsMapTicket");
const { syncAttachmentToDynamics, downloadBlobAsBase64 } = require("../utils/dynamicsAttachment");
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require("@azure/storage-blob");
const { v4: uuidv4 } = require("uuid");

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

        const incidentIds = rawTickets.map(t => t.incidentid);

        let notesMap = {};

        if (incidentIds.length > 0) {
            const notesFilter = incidentIds
                .map(id => `_objectid_value eq ${id}`)
                .join(' or ');

            const notesRes = await axios.get(
                `${process.env.DYNAMICS_URL}/api/data/v9.2/annotations?$filter=${notesFilter}&$select=annotationid,subject,notetext,createdon,filename,mimetype,_objectid_value`,
                { headers: dynamicsHeaders(token) }
            );

            notesRes.data.value.forEach(n => {
                const ticketId = n._objectid_value;

                if (!notesMap[ticketId]) {
                    notesMap[ticketId] = [];
                }

                notesMap[ticketId].push({
                    annotationid: n.annotationid,
                    subject: n.subject,
                    text: n.notetext,
                    createdOn: n.createdon,
                    filename: n.filename,
                    mimetype: n.mimetype
                });
            });
        }

        const tickets = rawTickets.map(ticket =>
            mapTicket(
                ticket,
                technicianMap[ticket._ss_assignedtechnician_value] ?? null,
                notesMap[ticket.incidentid] ?? []
            )
        );

        return res.status(200).json({ tickets, count: tickets.length });

    } catch (err) {
        return res.status(500).json({
            error: "Failed to fetch tickets from Dynamics",
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

        const ticketRes = await axios.get(
            `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents?$filter=ticketnumber eq '${ticketnumber}'&$select=${INCIDENT_SELECT_FIELDS}&$expand=${INCIDENT_EXPAND_FIELDS}`,
            { headers: dynamicsHeaders(token) }
        );

        const ticket = ticketRes.data.value?.[0];
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

        const notesRes = await axios.get(
            `${process.env.DYNAMICS_URL}/api/data/v9.2/annotations?$filter=_objectid_value eq ${ticket.incidentid}&$select=annotationid,subject,notetext,createdon,filename,mimetype`,
            { headers: dynamicsHeaders(token) }
        );

        const notes = notesRes.data.value.map(n => ({
            annotationid: n.annotationid,
            subject: n.subject,
            text: n.notetext,
            createdOn: n.createdon,
            filename: n.filename,
            mimetype: n.mimetype
        }));

        const mappedTicket = mapTicket(ticket, technicianname, notes);

        return res.status(200).json(mappedTicket);

    } catch (err) {
        return res.status(500).json({
            error: "Failed to fetch ticket from Dynamics",
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

const stripScheduleFromDescription = (description) => {
    if (!description) return "";
    
    const marker = "\n\nAvailable Date and Time for Support Call:";
    const index  = description.indexOf(marker);
    
    return index !== -1 ? description.slice(0, index) : description;
};

const buildDescriptionWithSchedule = (description, dates, startTimes, endTimes, timezone) => {
   
    const cleanDescription = stripScheduleFromDescription(description);

    const offset  = getUTCOffset(timezone);
    const tzLabel = offset ? `${timezone} (${offset})` : timezone;

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

    return `${cleanDescription}${scheduleSuffix}`;
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

const create_Ticket = async (req, res) => {
  try {
    const {
      entrauserid,
      entratenantid,
      title,
      description,
      date,
      starttime,
      endtime,
      usertimezone,
      officelocation,
      attachments,
      createdby,
      contactid,
    } = req.body;

    const io = req.app.get("io");

    const toArray = (val) => (Array.isArray(val) ? val : val ? [val] : []);
    const dates = toArray(date);
    const startTimes = toArray(starttime);
    const endTimes = toArray(endtime);

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
          entrauserid,
          entratenantid,
          title,
          fullDescription,
          dates,
          startTimes,
          endTimes,
          usertimezone,
          officelocation,
          toArray(attachments),
          createdby,
        ]
      ),
      getDynamicsToken(),
      client.query(
        "SELECT public.tenant_get_dynamicsaccountid($1) AS dynamicsaccountid",
        [entratenantid]
      ),
      client.query("SELECT * FROM public.user_get_info($1)", [entrauserid]),
    ]);

    const { ticketuuid, ticketnumber } = result.rows[0];
    const dynamicsAccountId =
      tenantResult.rows[0]?.dynamicsaccountid ?? null;
    const userInfo = userResult.rows[0] ?? {};

    res.status(201).json({
      ticketuuid,
      ticketnumber,
      dynamicsIncidentId: null,
    });

    syncToDynamics({
      io,
     entrauserid, 
      token,
      ticketuuid,
      dynamicsAccountId,
      userInfo,
      title,
      description: fullDescription,
      usertimezone,
      date: dates,
      starttime: startTimes,
      endtime: endTimes,
      contactid,
      attachments: toArray(attachments),
    }).catch((err) => {
      console.error("Background Dynamics sync failed:", err.message);

      io.to(entrauserid).emit("ticket:sync_failed", {
        ticketuuid,
        error: "Dynamics sync failed",
      });
    });
  } catch (err) {
    if (err.message) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: "Internal Server Error" });
  }
};
    
const syncToDynamics = async ({
    io, token, entrauserid, ticketuuid, dynamicsAccountId,
    userInfo, title, description, usertimezone,
    date, starttime, endtime, contactid, attachments
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
               Prefer: 'return=representation, odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
            }
        }
    );

    const dynamicsIncidentId   = dynamicsRes.data?.incidentid  ?? null;
    const dynamicsTicketNumber = dynamicsRes.data?.ticketnumber ?? null;
    const statusCode           = dynamicsRes.data?.statuscode   ?? null;
    // const dynamicsStatus       = DYNAMICS_STATUSCODE_MAP[statusCode] ?? "New";
    const dynamicsStatus       = dynamicsRes.data?.["ss_autotaskticketstatus@OData.Community.Display.V1.FormattedValue"] ?? null;
    // const sourceCode  = dynamicsRes.data?.ss_source ?? null;
    const sourceLabel = dynamicsRes.data?.["ss_source@OData.Community.Display.V1.FormattedValue"] ?? null;
    const category = dynamicsRes.data?.["ss_ticketcategory@OData.Community.Display.V1.FormattedValue"]  ?? null;
    const duedate = dynamicsRes.data?.["ss_duedate@OData.Community.Display.V1.FormattedValue"] ?? null;
    const priority = dynamicsRes.data?.["prioritycode@OData.Community.Display.V1.FormattedValue"]  ?? null;
    const ticketlifecycle = dynamicsRes.data?.["ss_ticketstage@OData.Community.Display.V1.FormattedValue"] ?? null;

    console.log("Dynamics incident created:", { dynamicsIncidentId, dynamicsTicketNumber, dynamicsStatus, sourceLabel, category, duedate, priority, ticketlifecycle });

   if (dynamicsIncidentId) {
        await client.query(
            "SELECT public.ticket_update_dynamics($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [ticketuuid, dynamicsIncidentId, dynamicsTicketNumber, dynamicsStatus, sourceLabel, category, duedate, priority, ticketlifecycle]
        );

        const updated = await client.query(
        "SELECT * FROM public.ticket_get($1, NULL, NULL)",
        [ticketuuid]
        );

        if (io && entrauserid && updated.rows[0]) {
        io.to(entrauserid).emit("ticket:synced", {
            ticketuuid,
            ticket: updated.rows[0],
        });
        console.log("[WS] Emitted ticket:synced to:", entrauserid);
        }


       const attachmentList = toArray(attachments);
    if (attachmentList.length > 0) {
     

        const annotationIds = await Promise.all(
            attachmentList.map(blobUrl =>
                syncAttachmentToDynamics({ token, dynamicsIncidentId, blobUrl })
            )
        ).catch(err => {
            console.error("[DYNAMICS] Attachment sync failed:", err.message);
            return [];
        });

        console.log(`[DYNAMICS] Returned annotationIds:`, annotationIds);

        for (let i = 0; i < attachmentList.length; i++) {
            const annotationid = annotationIds[i];
            const blobUrl      = attachmentList[i];

            if (!annotationid) {
                console.warn(`[DYNAMICS] No annotationid returned for index ${i}, skipping`);
                continue;
            }

            try {
                const updateResult = await client.query(
                    `SELECT public.attachment_update_annotation($1, $2)`,
                    [blobUrl, annotationid]
                );
             
            } catch (e) {
                console.error(`[DYNAMICS] Failed to save annotationid for ${blobUrl}:`, e.message);
            }
        }
        }
    }
};

const syncUpdateToDynamics = async ({
    token, dynamicsIncidentId,
    title, description, usertimezone,
    officelocation, date, starttime, endtime,
}) => {
    const toArray = (val) => Array.isArray(val) ? val : val ? [val] : [];

    const dates  = toArray(date);
    const starts = toArray(starttime);
    const ends   = toArray(endtime);

    const fullDescription = buildDescriptionWithSchedule(
        description,
        dates,
        starts,
        ends,
        usertimezone
    );

    const dynamicsPayload = {
        title,
        description:   fullDescription,
        ss_timezone:   usertimezone ?? null,
        // ss_officelocation: officelocation ?? null,
    };

    const toTimeShort = (t) => t ? t.slice(0, 5) : "00:00";

    if (dates.length > 0) {
        dynamicsPayload["ss_schedulestartdate"] = `${dates[0]}T${toTimeShort(starts[0])}:00Z`;
        dynamicsPayload["ss_scheduleenddate"]   = `${dates[dates.length - 1]}T${toTimeShort(ends[ends.length - 1])}:00Z`;
    }

    await axios.patch(
        `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents(${dynamicsIncidentId})`,
        dynamicsPayload,
        {
            headers: {
                Authorization:      `Bearer ${token}`,
                Accept:             "application/json",
                "Content-Type":     "application/json",
                "OData-Version":    "4.0",
                "OData-MaxVersion": "4.0",
            }
        }
    );

    console.log(`[DYNAMICS] Incident updated: ${dynamicsIncidentId}`);
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

        const dates      = toArray(date);
        const startTimes = toArray(starttime);
        const endTimes   = toArray(endtime);

        const [result, token, dynamicsResult] = await Promise.all([
            client.query(
                "SELECT * FROM ticket_update($1, $2, $3, $4, $5, $6, $7, $8, $9)",
                [
                    ticketuuid,
                    title,
                    description,
                    usertimezone,
                    officelocation,
                    dates,
                    startTimes,
                    endTimes,
                    modifiedby,
                ]
            ),
            getDynamicsToken(),
            client.query(
                "SELECT public.ticket_get_dynamicsincidentid($1) AS dynamicsincidentid",
                [ticketuuid]
            ),
        ]);

        const dynamicsIncidentId = dynamicsResult.rows[0]?.dynamicsincidentid ?? null;

        res.status(200).json(result.rows[0]);

        if (dynamicsIncidentId) {
            syncUpdateToDynamics({
                token,
                dynamicsIncidentId,
                title,
                description,
                usertimezone,
                officelocation,
                date:      dates,
                starttime: startTimes,
                endtime:   endTimes,
           }).catch(err => console.error("[DYNAMICS] Background update failed:", err.response?.data ?? err.message));
        } else {
            console.warn(`[DYNAMICS] No dynamicsincidentid for ticketuuid: ${ticketuuid} — skipping`);
        }

    } catch (err) {
        if (err.message) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const buildAccountMap = (filtered) => {
    const accountMap = new Map();
    const seenEntraIds = new Set();

    for (const t of filtered) {
        const accId = t._customerid_value;
        if (!accId || accountMap.has(accId)) continue;

        const entraTenantId = t.customerid_account?.ss_azuretenantid ?? null;

        accountMap.set(accId, {
            name: t["_customerid_value@OData.Community.Display.V1.FormattedValue"]
                ?? t.customerid_account?.name
                ?? "Unknown Company",
            entraTenantId: entraTenantId && !seenEntraIds.has(entraTenantId)
                ? entraTenantId
                : null,
        });

        if (entraTenantId) seenEntraIds.add(entraTenantId);
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
            entraTenantId: contact.parentcustomerid_account?.ss_azuretenantid ?? null,
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

    const contacts = [...contactMap.entries()];

    const emails         = contacts.map(([email])  => email);
    const usernames      = contacts.map(([, c])    => c.username      ?? null);
    const jobtitles      = contacts.map(([, c])    => c.jobtitle      ?? null);
    const businessphones = contacts.map(([, c])    => c.businessphone ?? null);
    const mobilephones   = contacts.map(([, c])    => c.mobilephone   ?? null);
    const departments    = contacts.map(([, c])    => c.department    ?? null);
    const userroles      = contacts.map(()         => "user");
    const entratenantids = contacts.map(([, c])    => c.entraTenantId ?? null);

    try {
        await client.query(
            `SELECT public.batch_user_insert($1, $2, $3, $4, $5, $6, $7, $8)`,
            [emails, usernames, jobtitles, businessphones, mobilephones, departments, userroles, entratenantids]
        );
    } catch (e) {
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
    // const statusCode  = ticket.statuscode ?? null;
    const statusLabel =ticket["ss_autotaskticketstatus@OData.Community.Display.V1.FormattedValue"]
                    //  ??  DYNAMICS_STATUSCODE_MAP[statusCode]
                     ?? null;
                     
    const createdby = ticket.ss_Contact?.emailaddress1 ?? null;

    await client.query(
        `SELECT * FROM public.ticket_sync_dynamics(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
            $31,$32,$33,$34,$35,$36,$37,$38,$39,$40
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
            ticket.ss_resolveddate                                                                          ?? null,
            ticket.modifiedon                                                                               ?? null,
            createdby,
            ticket.ss_resolution                                                                            ?? null,  
            ticket.ss_airouted                                                                              ?? 'false',
        ]
    );
};

const db_deleteMissingTickets = async (dynamicsIncidentIds, from = null, to = null) => {
    if (dynamicsIncidentIds.length === 0) return;

    try {
        await client.query(
            `SELECT public.ticket_missing_delete($1, $2, $3)`,
            [dynamicsIncidentIds, from, to]
        );
        console.log(`[SYNC] Missing tickets deleted.`);
    } catch (e) {
        console.error("db_deleteMissingTickets failed:", e.message);
        throw e;
    }
};


const stripHtml = (html) => {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
};

const db_syncTicketNotes = async (ticket, token) => {
    if (!ticket.incidentid) return;

    try {
        const url = `${process.env.DYNAMICS_URL}/api/data/v9.2/annotations`
            + `?$filter=_objectid_value eq ${ticket.incidentid}`
            + `&$select=annotationid,subject,notetext,createdon,modifiedon,_objectid_value`
            + `&$expand=createdby($select=internalemailaddress)`;

        const notesRes = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "OData-Version": "4.0",
                "OData-MaxVersion": "4.0",
            },
        });

        const notes = notesRes.data.value ?? [];
        console.log(`[NOTES] ${ticket.ticketnumber} — ${notes.length} notes`);

        if (notes.length === 0) return;

        const valid = notes.filter(n => {
            if (!n.annotationid || !n._objectid_value) {
                console.warn(`[NOTES] Skipping note due to missing IDs: ticket ${ticket.ticketnumber}`);
                return false;
            }
            return true;
        });

        if (valid.length === 0) return;

        const annotationids      = valid.map(n => n.annotationid);
        const dynamicsincidentids = valid.map(n => n._objectid_value);
        const subjects           = valid.map(n => n.subject ?? 'Note');
        const notetexts          = valid.map(n => stripHtml(n.notetext) ?? '');
        const createdon          = valid.map(n => n.createdon ?? new Date().toISOString());
        const modifiedon         = valid.map(n => n.modifiedon ?? n.createdon ?? new Date().toISOString());
        const createdby          = valid.map(n => n.createdby?.internalemailaddress ?? null);
        const modifiedby         = valid.map(() => null);

        await client.query(
            `SELECT public.note_sync_dynamics_batch($1, $2, $3, $4, $5, $6, $7, $8)`,
            [annotationids, dynamicsincidentids, subjects, notetexts, createdon, modifiedon, createdby, modifiedby]
        );

        console.log(`[NOTES] Batch synced ${valid.length} notes for ${ticket.ticketnumber}`);

    } catch (noteErr) {
        console.warn(`[NOTES] Failed fetching/syncing notes for ${ticket.ticketnumber}:`, noteErr.response?.data || noteErr.message);
    }
};

const sync_DynamicsTickets_toDB = async (req, res) => {
    try {
        const token = await getDynamicsToken();
        const ALLOWED_SOURCES = [18, 2, 4, 17, 19];

        const filter = `createdon ge 2026-01-01T00:00:00Z`;
        console.log(`Cron mode: MANUAL (Created from 2026-01-01)`);

        let allTickets = [];
        let nextLink = `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents?$select=${INCIDENT_SELECT_FIELDS}&$expand=${INCIDENT_EXPAND_FIELDS}&$filter=${encodeURIComponent(filter)}&$top=1000`;

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

        let synced = 0;
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

                const contactEmail = ticket.ss_Contact?.emailaddress1 ?? null;
                const userid = contactEmail ? (userMap[contactEmail] ?? null) : null;
                const technicianname = technicianMap[ticket._ss_assignedtechnician_value] ?? null;

                await db_syncTicket(ticket, tenantid, userid, technicianname);

                db_syncTicketNotes(ticket, token).catch(err => {
                    console.warn(`[NOTES] Background sync failed for ${ticket.ticketnumber}:`, err.message);
                });

                synced++;

            } catch (ticketErr) {
                console.error(`Failed to sync ${ticket.ticketnumber}:`, ticketErr.message);
                errors.push({ ticketnumber: ticket.ticketnumber, error: ticketErr.message });
                skipped++;
            }
        }

        const dynamicsIds = filtered.map(t => t.incidentid);
        await db_deleteMissingTickets(dynamicsIds, '2026-01-01T00:00:00Z', null);

        return res.status(200).json({
            message: "Dynamics ticket sync completed.",
            total: allTickets.length,
            filtered: filtered.length,
            synced,
            skipped,
            ...(errors.length > 0 && { errors }),
        });

    } catch (err) {
        console.error("sync_DynamicsTickets error:", err.message);
        return res.status(500).json({
            error: "Failed to sync tickets from Dynamics",
            details: err.response?.data || err.message,
        });
    }
};

const db_deleteMissingTickets_modifiedon = async (dynamicsIncidentIds, from = null, to = null) => {
    if (dynamicsIncidentIds.length === 0) return;

    try {
        await client.query(
            `SELECT public.ticket_missing_delete_modifiedon($1, $2, $3)`,
            [dynamicsIncidentIds, from, to]
        );
        console.log(`[SYNC] Missing tickets deleted.`);
    } catch (e) {
        console.error("db_deleteMissingTickets_modifiedon failed:", e.message);
        throw e;
    }
};

const sync_DynamicsTickets_toDB_auto = async (req, res) => {
    try {
        const token = await getDynamicsToken();
        const ALLOWED_SOURCES = [18, 2, 4, 17, 19];

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const filter = `modifiedon ge ${start.toISOString()} and modifiedon le ${end.toISOString()}`;
        console.log(`Cron mode: AUTOMATIC (modified from ${start.toISOString()} to ${end.toISOString()})`);

        let allTickets = [];
        let nextLink = `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents?$select=${INCIDENT_SELECT_FIELDS}&$expand=${INCIDENT_EXPAND_FIELDS}&$filter=${encodeURIComponent(filter)}&$top=1000`;

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

        let synced = 0;
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

                const contactEmail = ticket.ss_Contact?.emailaddress1 ?? null;
                const userid = contactEmail ? (userMap[contactEmail] ?? null) : null;
                const technicianname = technicianMap[ticket._ss_assignedtechnician_value] ?? null;

                await db_syncTicket(ticket, tenantid, userid, technicianname);
                await db_syncTicketNotes(ticket, token);
                synced++;
                
            } catch (ticketErr) {
                console.error(`Failed to sync ${ticket.ticketnumber}:`, ticketErr.message);
                errors.push({ ticketnumber: ticket.ticketnumber, error: ticketErr.message });
                skipped++;
            }
        }

        const dynamicsIds = filtered.map(t => t.incidentid);
        await db_deleteMissingTickets_modifiedon(dynamicsIds, start.toISOString(), end.toISOString());

        return res.status(200).json({
            message: "Dynamics ticket sync completed.",
            total: allTickets.length,
            filtered: filtered.length,
            synced,
            skipped,
            ...(errors.length > 0 && { errors }),
        });

    } catch (err) {
        console.error("sync_DynamicsTickets error:", err.message);
        return res.status(500).json({
            error: "Failed to sync tickets from Dynamics",
            details: err.response?.data || err.message,
        });
    }
};

const webhook_DynamicsTicketUpdate = async (req, res) => {
    try {
        const body = req.body;

        if (!body) {
            return res.status(400).json({ error: "Empty request body" });
        }

        const io = req.app.get("io");

        const incidentid = body?.PrimaryEntityId ?? null;

        if (!incidentid) {
            return res.status(400).json({ error: "Missing PrimaryEntityId in payload" });
        }

        const token = await getDynamicsToken();

        const response = await axios.get(
            `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents(${incidentid})?$select=${INCIDENT_SELECT_FIELDS}&$expand=${INCIDENT_EXPAND_FIELDS}`,
            {
                headers: {
                    Authorization:      `Bearer ${token}`,
                    Accept:             "application/json",
                    "OData-Version":    "4.0",
                    "OData-MaxVersion": "4.0",
                    Prefer:             "odata.include-annotations=OData.Community.Display.V1.FormattedValue",
                }
            }
        );

        const ticket = response.data;

        if (!ticket) {
            return res.status(404).json({ error: "Ticket not found in Dynamics" });
        }

        let technicianname = null;
        if (ticket._ss_assignedtechnician_value) {
            try {
                const techRes = await axios.get(
                    `${process.env.DYNAMICS_URL}/api/data/v9.2/systemusers(${ticket._ss_assignedtechnician_value})?$select=fullname`,
                    {
                        headers: {
                            Authorization:      `Bearer ${token}`,
                            Accept:             "application/json",
                            "OData-Version":    "4.0",
                            "OData-MaxVersion": "4.0",
                        }
                    }
                );
                technicianname = techRes.data.fullname ?? null;
            } catch {
                console.warn(`[WEBHOOK] Could not resolve technician: ${ticket._ss_assignedtechnician_value}`);
            }
        }

        // const statusCode  = ticket.statuscode ?? null;
        // const statusLabel = DYNAMICS_STATUSCODE_MAP[statusCode] ?? null;
        

        await client.query(
            `SELECT public.ticket_webhook_update(
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
            )`,
            [
                ticket.incidentid,                                                                                   // $1
                ticket.title                                                                                ?? null, // $2
                cleanDescription(ticket.description),                                                                // $3
                ticket._ss_assignedtechnician_value                                                         ?? null, // $4
                technicianname,                                                                                       // $5
                ticket.ss_timezone                                                                          ?? null, // $6
                ticket.ss_schedulestartdate                                                                 ?? null, // $7
                ticket.ss_scheduleenddate                                                                   ?? null, // $8
                ticket.ss_scheduletype                                                                      ?? null, // $9
                ticket["_ss_autotaskissuetype_value@OData.Community.Display.V1.FormattedValue"]             ?? null, // $10
                ticket["_ss_autotasksubissuetype_value@OData.Community.Display.V1.FormattedValue"]          ?? null, // $11
                ticket.ss_skillrequired                                                                     ?? null, // $12
                ticket["ss_worktype@OData.Community.Display.V1.FormattedValue"]                             ?? null, // $13
                ticket.ss_duedate                                                                           ?? null, // $14
                ticket["ss_ticketurgency@OData.Community.Display.V1.FormattedValue"] ?? ticket.ss_ticketurgency ?? null, // $15
                ticket.ss_ticketimpact                                                                      ?? null, // $16
                ticket["ss_source@OData.Community.Display.V1.FormattedValue"]                               ?? null, // $17
                ticket.ss_estimatedhours?.toString()                                                        ?? null, // $18
                ticket.ss_actualhours?.toString()                                                           ?? null, // $19
                ticket["_slainvokedid_value@OData.Community.Display.V1.FormattedValue"]                     ?? null, // $20
                ticket.ss_requesttype                                                                       ?? null, // $21
                ticket["_ss_contract_value@OData.Community.Display.V1.FormattedValue"]                      ?? null, // $22
                ticket["ss_ticketstage@OData.Community.Display.V1.FormattedValue"]                          ?? null, // $23
                ticket.ss_customerconfirmation                                                              ?? null, // $24
                ticket["ss_ticketcategory@OData.Community.Display.V1.FormattedValue"]                       ?? null, // $25
                ticket["ss_tickettype@OData.Community.Display.V1.FormattedValue"]                           ?? null, // $26
                ticket["prioritycode@OData.Community.Display.V1.FormattedValue"]                            ?? null, // $27
                ticket["ss_autotaskticketstatus@OData.Community.Display.V1.FormattedValue"]                 ?? null,// $28
                ticket.ss_quickfixflag?.toString()                                                         ?? null, // $29
                ticket.ss_reason                                                                            ?? null, // $30
                ticket.ss_completedonautotask                                                               ?? null, // $31
                ticket.ss_resolution                                                                        ?? null, // $32
            ]
        );

        console.log(`[WEBHOOK] Ticket updated from Dynamics: ${ticket.ticketnumber}`);

        if (io) {
            try {
                const ticketInfoResult = await client.query(
                    `SELECT * FROM ticket_get_webhook_info($1::text[])`,
                    [[incidentid]]
                );

                const ticketInfo = ticketInfoResult.rows[0] ?? null;

                if (ticketInfo) {
                    const { entrauserid, entratenantid, ticketuuid } = ticketInfo;

                    const updatedResult = await client.query(
                        `SELECT * FROM public.ticket_get($1, NULL, NULL)`,
                        [String(ticketuuid)]
                    );

                    const updatedTicket = updatedResult.rows[0] ?? null;

                    const payload = {
                        ticketuuid:         String(ticketuuid),
                        dynamicsincidentid: incidentid,
                        ticket:             updatedTicket,
                    };

                    if (entrauserid) {
                        io.to(entrauserid).emit("ticket:updated", payload);
                        console.log(`[WS] Emitted ticket:updated to user: ${entrauserid}`);
                    }

                    // if (entratenantid) {
                    //     io.to(entratenantid).emit("ticket:updated", payload);
                    //     console.log(`[WS] Emitted ticket:updated to tenant: ${entratenantid}`);
                    // }
                }
            } catch (wsErr) {
                console.error("[WEBHOOK] Socket emit failed:", wsErr.message);
            }
        }

        return res.status(200).json({
            message:      "Ticket updated successfully",
            ticketnumber: ticket.ticketnumber,
            incidentid:   ticket.incidentid,
        });

    } catch (err) {
        if (err.message?.includes('Ticket not found')) {
            return res.status(404).json({ error: err.message });
        }

        console.error("[WEBHOOK] Error:", err.message);
        return res.status(500).json({
            error:   "Failed to process Dynamics webhook",
            details: err.message,
        });
    }
};

const webhook_DynamicsTicketDelete = async (req, res) => {
    try {
        const body = req.body;

        if (!body) {
            return res.status(400).json({ error: "Empty request body" });
        }

        const io = req.app.get("io");

        const raw = body?.PrimaryEntityId ?? body?.incidentids ?? null;
        const incidentids = Array.isArray(raw) ? raw : raw ? [raw] : [];

        if (incidentids.length === 0) {
            return res.status(400).json({ error: "Missing PrimaryEntityId or incidentids in payload" });
        }

        const ticketInfoResult = await client.query(
            `SELECT * FROM ticket_get_webhook_info($1::text[])`,
            [incidentids]
        );

        const ticketInfoList = ticketInfoResult.rows ?? [];

        await client.query(
            `SELECT public.ticket_webhook_delete($1::text[])`,
            [incidentids]
        );

        console.log(`[WEBHOOK] Deleted ${incidentids.length} ticket(s) from DB`);

        if (io && ticketInfoList.length > 0) {
            for (const ticketInfo of ticketInfoList) {
                const { entrauserid, entratenantid, ticketuuid, dynamicsincidentid } = ticketInfo;

                const payload = {
                    ticketuuid:         String(ticketuuid),
                    dynamicsincidentid,
                };

                if (entrauserid) {
                    io.to(entrauserid).emit("ticket:deleted", payload);
                    console.log(`[WS] Emitted ticket:deleted to user: ${entrauserid}, ticketuuid: ${ticketuuid}`);
                }

                // if (entratenantid) {
                //     io.to(entratenantid).emit("ticket:deleted", payload);
                //     console.log(`[WS] Emitted ticket:deleted to tenant: ${entratenantid}`);
                // }
            }
        }

        return res.status(200).json({
            message: `Deleted ${ticketInfoList.length} ticket(s)`,
            deleted: ticketInfoList.length,
        });

    } catch (err) {
        console.error("[WEBHOOK] Delete error:", err.message);
        return res.status(500).json({
            error:   "Failed to process Dynamics delete webhook",
            details: err.message,
        });
    }
};

const stripHtml2 = (html) => {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/gs, '')   
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')      
        .trim();
};

const webhook_DynamicsNoteSync = async (req, res) => {
    try {
        const body = req.body;

        if (!body) {
            return res.status(400).json({ error: "Empty request body" });
        }

        const annotationid = body?.PrimaryEntityId ?? null;
        if (!annotationid) {
            return res.status(400).json({ error: "Missing PrimaryEntityId in payload" });
        }

        const messageName = body?.MessageName?.toLowerCase() ?? null;
        if (!messageName) {
            return res.status(400).json({ error: "Missing MessageName in payload" });
        }

        if (messageName === "delete") {
            await client.query(
                `SELECT public.note_webhook_delete($1)`,
                [annotationid]
            );

            console.log(`[WEBHOOK] Annotation deleted: ${annotationid}`);

            return res.status(200).json({
                message: "Annotation deleted successfully",
                annotationid,
            });
        }

        if (messageName === "create" || messageName === "update") {
            const token = await getDynamicsToken();

            const noteRes = await axios.get(
                 `${process.env.DYNAMICS_URL}/api/data/v9.2/annotations(${annotationid})?$select=annotationid,subject,notetext,createdon,modifiedon,isdocument,filename,mimetype,_objectid_value&$expand=createdby($select=internalemailaddress)`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                        "OData-Version": "4.0",
                        "OData-MaxVersion": "4.0",
                    },
                }
            );

            const note = noteRes.data;

            if (!note) {
                return res.status(404).json({ error: "Note not found in Dynamics" });
            }

            const incidentid = note._objectid_value ?? null;

            if (!incidentid) {
                return res.status(400).json({ error: "Note is not linked to an incident" });
            }

            const ticketRes = await client.query(
                `SELECT public.ticket_get_incidentid($1) AS ticketid`,
                [incidentid]
            );

            const ticketid  = ticketRes.rows[0]?.ticketid ?? null;
            const createdby = note.createdby?.internalemailaddress ?? null;

            const results = {
                annotationid,
                note:       false,
                attachment: false,
            };

            if (note.notetext) {
                await client.query(
                    `SELECT public.note_webhook_sync($1, $2, $3, $4, $5, $6)`,
                    [
                        note.annotationid,
                        ticketid,
                        stripHtml2(note.notetext),
                        note.createdon ?? null,
                        note.modifiedon ?? null,
                        createdby,
                    ]
                );

                results.note = true;
                console.log(`[WEBHOOK] Note synced (${messageName}): ${annotationid}`);
            }

           if (note.isdocument && note.filename) {
                try {

                    const fileRes = await axios.get(
                        `${process.env.DYNAMICS_URL}/api/data/v9.2/annotations(${annotationid})/documentbody/$value`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                Accept: "application/octet-stream",
                                "OData-Version": "4.0",
                                "OData-MaxVersion": "4.0",
                            },
                            responseType: "arraybuffer",
                        }
                    );

                    const buffer   = Buffer.from(fileRes.data);
                    const mimetype = note.mimetype || "application/octet-stream";
                    const originalName = note.filename.replace(/[^a-zA-Z0-9.\-_]/g, '-');
                    const blobName = `${uuidv4()}-${originalName}`;

                    const blobServiceClient = BlobServiceClient.fromConnectionString(
                        process.env.AZURE_STORAGE_CONNECTION_STRING
                    );
                    const containerClient = blobServiceClient.getContainerClient(
                        process.env.AZURE_STORAGE_CONTAINER || "images"
                    );
                    await containerClient.createIfNotExists();

                    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
                    await blockBlobClient.uploadData(buffer, {
                        blobHTTPHeaders: { blobContentType: mimetype },
                    });

                    const sharedKeyCredential = new StorageSharedKeyCredential(
                        process.env.AZURE_STORAGE_ACCOUNT_NAME,
                        process.env.AZURE_STORAGE_ACCOUNT_KEY
                    );
                    const sasToken = generateBlobSASQueryParameters(
                        {
                            containerName: process.env.AZURE_STORAGE_CONTAINER || "images",
                            blobName,
                            permissions: BlobSASPermissions.parse("r"),
                            startsOn:  new Date(),
                            expiresOn: new Date(new Date().valueOf() + 365 * 24 * 60 * 60 * 1000),
                        },
                        sharedKeyCredential
                    ).toString();

                    const blobUrl = `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${process.env.AZURE_STORAGE_CONTAINER || "images"}/${blobName}?${sasToken}`;

                    await client.query(
                        `SELECT public.attachment_webhook_sync($1, $2, $3, $4, $5)`,
                        [
                            note.annotationid,
                            ticketid,
                            blobUrl,          
                            note.createdon ?? null,
                            createdby,
                        ]
                    );

                    results.attachment = true;
                    console.log(`[WEBHOOK] Attachment synced (${messageName}): ${annotationid} → ${note.filename}`);

                } catch (attachErr) {
                    console.error(`[WEBHOOK] Attachment upload failed for ${annotationid}:`, attachErr.message);
            
                }
            }

            return res.status(200).json({
                message: `Annotation ${messageName}d successfully`,
                ...results,
            });
        }

        return res.status(400).json({
            error: `Unhandled MessageName: ${messageName}`,
        });

    } catch (err) {
        const status = err.response?.status;
        const data   = err.response?.data;

        console.error("[WEBHOOK] Note sync error:", {
            message: err.message,
            status,
            data,
        });

        return res.status(status || 500).json({
            error:           "Failed to process Dynamics note webhook",
            details:         err.message,
            dynamicsStatus:  status || null,
            dynamicsResponse: data || null,
        });
    }
};


const reactivate_DynamicsTicket = async (req, res) => {
    try {
        const { ticketuuid } = req.body;

        if (!ticketuuid) {
            return res.status(400).json({ error: "ticketuuid is required" });
        }

        const dynamicsResult = await client.query(
            "SELECT public.ticket_get_dynamicsincidentid($1) AS dynamicsincidentid",
            [ticketuuid]
        );

        const dynamicsIncidentId = dynamicsResult.rows[0]?.dynamicsincidentid ?? null;

        if (!dynamicsIncidentId) {
            return res.status(404).json({ error: "No Dynamics incident linked to this ticket" });
        }

        const token = await getDynamicsToken();

        await axios.patch(
            `${process.env.DYNAMICS_URL}/api/data/v9.2/incidents(${dynamicsIncidentId})`,
            {
                statecode:  0,       
                statuscode: 196780008 
            },
            {
                headers: {
                    Authorization:      `Bearer ${token}`,
                    Accept:             "application/json",
                    "Content-Type":     "application/json",
                    "OData-Version":    "4.0",
                    "OData-MaxVersion": "4.0",
                }
            }
        );

        console.log(`[DYNAMICS] Ticket reactivated: ${dynamicsIncidentId}`);
        return res.status(200).json({ message: "Ticket reactivated successfully", dynamicsIncidentId });

    } catch (err) {
        console.error("[DYNAMICS] Reactivate error:", err.response?.data ?? err.message);
        return res.status(500).json({
            error:   "Failed to reactivate ticket in Dynamics",
            details: err.response?.data ?? err.message,
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
    sync_DynamicsTickets_toDB,
    sync_DynamicsTickets_toDB_auto,
    webhook_DynamicsTicketUpdate,
    webhook_DynamicsTicketDelete,
    webhook_DynamicsNoteSync,
    reactivate_DynamicsTicket,
};