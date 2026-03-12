/**
 * @swagger
 * tags:
 *   name: Attachments
 *   description: Attachment management endpoints
 */
 
/**
 * @swagger
 * /attachments:
 *   get:
 *     summary: Get attachments (all, by ticket UUID, or by attachment UUID)
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ticketuuid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by ticket UUID
 *         example: "340a5679-ad90-4275-b082-7375698f08fb"
 *       - in: query
 *         name: attachmentuuid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by attachment UUID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Successfully retrieved attachments
 *         content:
 *           application/json:
 *             example:
 *               - v_attachmentuuid: "550e8400-e29b-41d4-a716-446655440000"
 *                 v_ticketuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *                 v_attachment: "https://storage.example.com/attachments/file1.pdf"
 *                 v_createdat: "2026-01-01T09:00:00Z"
 *                 v_createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 v_modifiedat: null
 *                 v_modifiedby: null
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "VALIDATION_ERROR: Ticket with UUID 340a5679-ad90-4275-b082-7375698f08fb does not exist or has been deleted."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */
 
/**
 * @swagger
 * /attachments:
 *   post:
 *     summary: Create attachments for a ticket
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             ticketuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *             attachments:
 *               - "https://storage.example.com/attachments/file1.pdf"
 *               - "https://storage.example.com/attachments/screenshot.png"
 *             createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       201:
 *         description: Successfully created, returns array of attachment UUIDs
 *         content:
 *           application/json:
 *             example:
 *               attachmentuuids:
 *                 - "550e8400-e29b-41d4-a716-446655440000"
 *                 - "661f9511-f30c-52e5-b827-557766551111"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             examples:
 *               ticketNotFound:
 *                 summary: Ticket does not exist or has been deleted
 *                 value:
 *                   error: "VALIDATION_ERROR: Ticket with UUID 340a5679-ad90-4275-b082-7375698f08fb does not exist or has been deleted."
 *               noAttachments:
 *                 summary: No attachments provided
 *                 value:
 *                   error: "VALIDATION_ERROR: At least one attachment must be provided."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */
 
/**
 * @swagger
 * /attachments:
 *   put:
 *     summary: Update attachments for a ticket (soft deletes removed, inserts new, keeps existing)
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             ticketuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *             attachments:
 *               - "https://storage.example.com/attachments/updated-file.pdf"
 *               - "https://storage.example.com/attachments/new-screenshot.png"
 *             modifiedby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully updated, returns array of active attachment UUIDs
 *         content:
 *           application/json:
 *             example:
 *               attachmentuuids:
 *                 - "550e8400-e29b-41d4-a716-446655440000"
 *                 - "661f9511-f30c-52e5-b827-557766551111"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "VALIDATION_ERROR: Ticket with UUID 340a5679-ad90-4275-b082-7375698f08fb does not exist or has been deleted."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */