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
 *     summary: Get tickets (all, by ticket UUID, or by user ID)
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
 *         name: userid
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter by user ID (returns all tickets of that user)
 *         example: 1
 *     responses:
 *       200:
 *         description: Successfully retrieved tickets
 *         content:
 *           application/json:
 *             example:
 *               - ticketid: 1
 *                 ticketuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *                 ticketnumber: "TKT-0001"
 *                 userid: 1
 *                 entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 username: "John Doe"
 *                 jobtitle: "Software Engineer"
 *                 useremail: "john.doe@sparta.com"
 *                 department: "Engineering"
 *                 entratechnicianid: null
 *                 title: "Server is down"
 *                 description: "Production server is not responding"
 *                 timezone: "Asia/Manila"
 *                 officelocation: "remote"
 *                 category: null
 *                 priority: null
 *                 status: "Open"
 *                 closurenote: null
 *                 closuredate: null
 *                 tenantid: 1
 *                 entratenantid: "1159156a-3971-429d-bb02-bd37b1223d24"
 *                 tenantname: "Sparta Services LLC"
 *                 tenantemail: "admin@sparta.com"
 *                 createdat: "2024-01-01T09:00:00Z"
 *                 createdby: "john.doe@sparta.com"
 *                 modifiedat: null
 *                 modifiedby: null
 *                 notes: []
 *                 attachments:
 *                   - v_attachmentid: 1
 *                     v_attachmentuuid: "uuid-here"
 *                     v_attachment: "file1.pdf"
 *                     v_createdat: "2024-01-01T09:00:00Z"
 *                     v_createdby: "john.doe@sparta.com"
 *                 supportcalls:
 *                   - v_supportcallid: 1
 *                     v_supportcalluuid: "uuid-here"
 *                     v_date: "2024-01-01"
 *                     v_starttime: "09:00:00"
 *                     v_endtime: "10:00:00"
 *                     v_createdat: "2024-01-01T09:00:00Z"
 *                     v_createdby: "john.doe@sparta.com"
 *                 tickettechnicians: []
 *                 ticketstatuses: []
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *             entratenantid: "1159156a-3971-429d-bb02-bd37b1223d24"
 *             title: "Server is down"
 *             description: "Production server is not responding"
 *             date: ["2024-01-01", "2024-01-02", "2024-01-03"]
 *             starttime: ["09:00", "10:00", "14:00"]
 *             endtime: ["10:00", "11:00", "15:00"]
 *             usertimezone: "Asia/Manila"
 *             officelocation: "remote"
 *             attachments: ["file1.pdf", "screenshot.png"]
 *             createdby: "john.doe@sparta.com"
 *     responses:
 *       201:
 *         description: Successfully created, returns new ticket UUID
 *         content:
 *           application/json:
 *             example:
 *               ticketuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Start time must be earlier than end time."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */