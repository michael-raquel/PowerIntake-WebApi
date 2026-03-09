/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: Ticket management endpoints
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