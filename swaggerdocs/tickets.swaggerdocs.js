/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: Ticket management endpoints
 */
 
/**
 * @swagger
 * /tickets:
 *   get:
 *     summary: Get tickets (all, by ticket UUID, by EntraUserID, or by EntraTenantID)
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ticketuuid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by ticket UUID (returns single ticket)
 *         example: "340a5679-ad90-4275-b082-7375698f08fb"
 *       - in: query
 *         name: entrauserid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by Entra User ID (returns all tickets of that user)
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *       - in: query
 *         name: entratenantid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by Entra Tenant ID (returns all tickets of that tenant)
 *         example: "1159156a-3971-429d-bb02-bd37b1223d24"
 *     responses:
 *       200:
 *         description: Successfully retrieved tickets
 *         content:
 *           application/json:
 *             example:
 *               - v_ticketid: 1
 *                 v_ticketuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *                 v_ticketnumber: "TKT-2026-000001"
 *                 v_technicianid: "entra-tech-001"
 *                 v_technicianname: "Alex Rivera"
 *                 v_ticketlifecycle: "Active"
 *                 v_ticketcategory: "Network"
 *                 v_priority: "High"
 *                 v_status: "Submitted"
 *                 v_closurenote: null
 *                 v_closuredate: null
 *                 v_userid: 1
 *                 v_entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 v_username: "John Doe"
 *                 v_jobtitle: "Software Engineer"
 *                 v_useremail: "john.doe@sparta.com"
 *                 v_department: "Engineering"
 *                 v_title: "Server is down"
 *                 v_description: "Production server is not responding"
 *                 v_usertimezone: "Asia/Manila"
 *                 v_officelocation: "remote"
 *                 v_tenantid: 1
 *                 v_entratenantid: "1159156a-3971-429d-bb02-bd37b1223d24"
 *                 v_tenantname: "Sparta Services LLC"
 *                 v_tenantemail: "admin@sparta.com"
 *                 v_createdat: "2026-01-01T09:00:00Z"
 *                 v_createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 v_modifiedat: null
 *                 v_modifiedby: null
 *                 v_notes: []
 *                 v_attachments:
 *                   - v_attachmentid: 1
 *                     v_attachmentuuid: "uuid-here"
 *                     v_attachment: "file1.pdf"
 *                     v_createdat: "2026-01-01T09:00:00Z"
 *                     v_createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 v_supportcalls:
 *                   - v_supportcallid: 1
 *                     v_supportcalluuid: "uuid-here"
 *                     v_date: "2026-01-01"
 *                     v_starttime: "09:00:00"
 *                     v_endtime: "10:00:00"
 *                     v_createdat: "2026-01-01T09:00:00Z"
 *                     v_createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 v_tickettechnicians:
 *                   - v_tickettechnicianid: 1
 *                     v_entratechnicianid: "entra-tech-001"
 *                     v_technicianname: "Alex Rivera"
 *                     v_createdat: "2026-01-01T09:00:00Z"
 *                     v_createdby: "entra-user-admin"
 *                 v_ticketstatuses:
 *                   - v_ticketstatusid: 1
 *                     v_status: "Submitted"
 *                     v_createdat: "2026-01-01T09:00:00Z"
 *                     v_createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */
 
/**
 * @swagger
 * /tickets/status:
 *   get:
 *     summary: Get ticket status
 *     description: Retrieves the status of a specific ticket using its UUID. Returns all statuses if no UUID is provided.
 *     tags:
 *       - Tickets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ticketuuid
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the ticket to retrieve status for
 *         example: "340a5679-ad90-4275-b082-7375698f08fb"
 *     responses:
 *       200:
 *         description: Ticket status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 v_ticketstatusid:
 *                   type: integer
 *                   example: 1
 *                 v_ticketid:
 *                   type: integer
 *                   example: 42
 *                 v_ticketuuid:
 *                   type: string
 *                   format: uuid
 *                   example: "340a5679-ad90-4275-b082-7375698f08fb"
 *                 v_ticketnumber:
 *                   type: string
 *                   example: "TKT-2026-000001"
 *                 v_status:
 *                   type: string
 *                   example: "Submitted"
 *                 v_createdat:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-03-12T09:00:00.000Z"
 *                 v_createdby:
 *                   type: string
 *                   example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized: No token provided"
 *       404:
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Ticket not found"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal Server Error"
 */
 
/**
 * @swagger
 * /tickets/manager-team:
 *   get:
 *     summary: Get all tickets of a manager's direct reports
 *     description: Fetches all direct reports of a manager from Microsoft Entra ID, then retrieves all tickets associated with each team member.
 *     tags:
 *       - Tickets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: managerid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The Entra User ID of the manager
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved tickets for all direct reports
 *         content:
 *           application/json:
 *             example:
 *               manager: "aabbccdd-1234-5678-abcd-ef1234567890"
 *               team:
 *                 - user: "John Doe"
 *                   entrauserid: "bbccddee-1234-5678-abcd-ef1234567890"
 *                   tickets:
 *                     - v_ticketid: 1
 *                       v_ticketuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *                       v_ticketnumber: "TKT-2026-000001"
 *                       v_technicianid: "entra-tech-001"
 *                       v_technicianname: "Alex Rivera"
 *                       v_ticketlifecycle: "Active"
 *                       v_ticketcategory: "Network"
 *                       v_priority: "High"
 *                       v_status: "Submitted"
 *                       v_closurenote: null
 *                       v_closuredate: null
 *                       v_userid: 1
 *                       v_entrauserid: "bbccddee-1234-5678-abcd-ef1234567890"
 *                       v_username: "John Doe"
 *                       v_jobtitle: "Software Engineer"
 *                       v_useremail: "john.doe@sparta.com"
 *                       v_department: "Engineering"
 *                       v_title: "Server is down"
 *                       v_description: "Production server is not responding"
 *                       v_usertimezone: "Asia/Manila"
 *                       v_officelocation: "remote"
 *                       v_createdat: "2026-01-01T09:00:00Z"
 *                       v_createdby: "bbccddee-1234-5678-abcd-ef1234567890"
 *                       v_modifiedat: null
 *                       v_modifiedby: null
 *                 - user: "Jane Smith"
 *                   entrauserid: "ccddeeaa-1234-5678-abcd-ef1234567890"
 *                   tickets: []
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /tickets/manager:
 *   get:
 *     summary: Get tickets for a manager's team from the database
 *     tags: [Tickets]
 *     parameters:
 *       - in: query
 *         name: managerentrauserid
 *         required: true
 *         schema:
 *           type: string
 *         description: Manager Entra user ID
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by ticket status
 *         example: "Submitted"
 *     responses:
 *       200:
 *         description: Successfully retrieved manager team tickets
 *         content:
 *           application/json:
 *             example:
 *               - v_ticketnumber: "TKT20260317-0000001"
 *                 v_username: "John Doe"
 *                 v_title: "Server is down"
 *                 v_category: "Network"
 *                 v_priority: "High"
 *                 v_createdat: "2026-03-17T09:00:00Z"
 *                 v_status: "Submitted"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Manager not found with entrauserid: aabbccdd-1234-5678-abcd-ef1234567890"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */
 
/**
 * @swagger
 * /tickets:
 *   post:
 *     summary: Create a new ticket
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *             entratenantid: "1159156a-3971-429d-bb02-bd37b1223d24"
 *             title: "Server is down"
 *             description: "Production server is not responding"
 *             date: ["2026-01-01", "2026-01-02", "2026-01-03"]
 *             starttime: ["09:00", "10:00", "14:00"]
 *             endtime: ["10:00", "11:00", "15:00"]
 *             usertimezone: "Asia/Manila"
 *             officelocation: "remote"
 *             attachments: ["file1.pdf", "screenshot.png"]
 *             createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       201:
 *         description: Successfully created, returns new ticket UUID and ticket number
 *         content:
 *           application/json:
 *             example:
 *               ticketuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *               ticketnumber: "TKT20260316-0000001"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             examples:
 *               startTimeError:
 *                 summary: Start time not before end time
 *                 value:
 *                   error: "Start time must be earlier than end time."
 *               overlapError:
 *                 summary: Overlapping support call schedules
 *                 value:
 *                   error: "Support call schedules have overlapping times."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */
 
/**
 * @swagger
 * /tickets:
 *   put:
 *     summary: Update an existing ticket
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             ticketuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *             title: "Server is down - Updated"
 *             description: "Production server is still not responding after restart."
 *             usertimezone: "Asia/Manila"
 *             officelocation: "hybrid"
 *             date: ["2026-01-05", "2026-01-06"]
 *             starttime: ["09:00", "13:00"]
 *             endtime: ["10:30", "14:00"]
 *             modifiedby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully updated, returns ticket UUID
 *         content:
 *           application/json:
 *             example:
 *               ticket_update: "340a5679-ad90-4275-b082-7375698f08fb"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             examples:
 *               notFound:
 *                 summary: Ticket not found or deleted
 *                 value:
 *                   error: "VALIDATION_ERROR: Ticket with UUID 340a5679-ad90-4275-b082-7375698f08fb does not exist or has been deleted."
 *               startTimeError:
 *                 summary: Start time not before end time
 *                 value:
 *                   error: "Start time must be earlier than end time."
 *               overlapError:
 *                 summary: Overlapping support call schedules
 *                 value:
 *                   error: "Support call schedules have overlapping times."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */