/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notification management endpoints
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get notifications for a user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: useruuid
 *         required: true
 *         schema:
 *           type: string
 *         description: User UUID to fetch notifications for
 *         example: "340a5679-ad90-4275-b082-7375698f08fb"
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               - v_notificationuuid: "b6d4f8a7-5a3f-4f6a-a2f0-95d58a4a8f81"
 *                 v_ticketuuid: "550e8400-e29b-41d4-a716-446655440000"
 *                 v_ticketnumber: "TKT-2026-000001"
 *                 v_message: "Ticket has been resolved."
 *                 v_isread: false
 *                 v_createdat: "2026-04-11T08:30:00Z"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: "useruuid is required"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized: No token provided"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 *
 *   post:
 *     summary: Create a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - useruuid
 *               - ticketuuid
 *               - message
 *               - createdby
 *             properties:
 *               useruuid:
 *                 type: string
 *                 example: "340a5679-ad90-4275-b082-7375698f08fb"
 *               ticketuuid:
 *                 type: string
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               message:
 *                 type: string
 *                 example: "Your ticket was updated by technician."
 *               createdby:
 *                 type: string
 *                 example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       201:
 *         description: Notification created successfully
 *         content:
 *           application/json:
 *             example:
 *               notificationuuid: "b6d4f8a7-5a3f-4f6a-a2f0-95d58a4a8f81"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: "useruuid, ticketuuid, message, and createdby are required"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized: No token provided"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /notifications/isread:
 *   patch:
 *     summary: Mark one or all notifications as read/unread
 *     description: If notificationuuid is omitted, updates all active notifications for the user.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - useruuid
 *               - isread
 *               - modifiedby
 *             properties:
 *               useruuid:
 *                 type: string
 *                 example: "340a5679-ad90-4275-b082-7375698f08fb"
 *               isread:
 *                 oneOf:
 *                   - type: boolean
 *                   - type: string
 *                 description: Accepts true/false as boolean or string
 *                 example: true
 *               modifiedby:
 *                 type: string
 *                 example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *               notificationuuid:
 *                 type: string
 *                 nullable: true
 *                 example: "b6d4f8a7-5a3f-4f6a-a2f0-95d58a4a8f81"
 *     responses:
 *       200:
 *         description: Notification read status updated successfully
 *         content:
 *           application/json:
 *             example:
 *               message: "Notification isread updated successfully"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             examples:
 *               missingFields:
 *                 value:
 *                   error: "useruuid, isread, and modifiedby are required"
 *               invalidIsRead:
 *                 value:
 *                   error: "isread must be true or false"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized: No token provided"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /notifications:
 *   delete:
 *     summary: Soft delete one or all notifications for a user
 *     description: If notificationuuid is omitted, soft deletes all active notifications for the user.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - useruuid
 *               - deletedby
 *             properties:
 *               useruuid:
 *                 type: string
 *                 example: "340a5679-ad90-4275-b082-7375698f08fb"
 *               deletedby:
 *                 type: string
 *                 example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *               notificationuuid:
 *                 type: string
 *                 nullable: true
 *                 example: "b6d4f8a7-5a3f-4f6a-a2f0-95d58a4a8f81"
 *     responses:
 *       200:
 *         description: Notification delete successful
 *         content:
 *           application/json:
 *             example:
 *               message: "Notification delete successful"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: "useruuid and deletedby are required"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized: No token provided"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */