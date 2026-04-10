/**
 * @swagger
 * tags:
 *   name: PowerSuiteAILogs
 *   description: PowerSuite AI logs endpoints
 */

/**
 * @swagger
 * /powersuiteailogs:
 *   get:
 *     summary: Get PowerSuite AI logs (all, by log UUID, by Entra User ID, or by ticket number)
 *     tags: [PowerSuiteAILogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: powersuiteailogsuuid
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by PowerSuite AI log UUID
 *         example: "340a5679-ad90-4275-b082-7375698f08fb"
 *       - in: query
 *         name: entrauserid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by Entra user ID
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *       - in: query
 *         name: ticketnumber
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by ticket number
 *         example: "TKT-2026-000001"
 *     responses:
 *       200:
 *         description: Successfully retrieved PowerSuite AI logs
 *         content:
 *           application/json:
 *             example:
 *               - v_powersuiteailogsid: 1
 *                 v_powersuiteailogsuuid: "550e8400-e29b-41d4-a716-446655440000"
 *                 v_entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 v_ticketnumber: "TKT-2026-000001"
 *                 v_title: "Suggested resolution"
 *                 v_description: "The user reported a login error."
 *                 v_suggestion: "Clear browser cache and retry."
 *                 v_rightanswer: "Clear cache resolved the issue."
 *                 v_createdat: "2026-04-10T09:00:00Z"
 *                 v_createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 v_modifiedat: null
 *                 v_modifiedby: null
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 *
 *   post:
 *     summary: Create a PowerSuite AI log
 *     tags: [PowerSuiteAILogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             entrauserid: "52f63ace-f750-4b3e-aaa2-cb48923602d2"
 *             title: "VPN Connection Issue"
 *             description: "User is unable to connect to VPN after OS update."
 *             suggestion: "Try reinstalling the VPN client and updating the network adapter drivers."
 *             createdby: "52f63ace-f750-4b3e-aaa2-cb48923602d2"
 *     responses:
 *       201:
 *         description: PowerSuite AI log created successfully
 *         content:
 *           application/json:
 *             example:
 *               powersuiteailogsuuid: "550e8400-e29b-41d4-a716-446655440000"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "VALIDATION_ERROR: User with EntraUserID 52f63ace-f750-4b3e-aaa2-cb48923602d2 does not exist."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 *
 *   patch:
 *     summary: Update PowerSuite AI log ticket link
 *     tags: [PowerSuiteAILogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             powersuiteailogsuuid: "550e8400-e29b-41d4-a716-446655440000"
 *             ticketuuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *     responses:
 *       200:
 *         description: PowerSuite AI log updated successfully
 *         content:
 *           application/json:
 *             example:
 *               powersuiteailogsuuid: "550e8400-e29b-41d4-a716-446655440000"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             examples:
 *               logNotFound:
 *                 summary: Log not found
 *                 value:
 *                   error: "VALIDATION_ERROR: PowerSuiteAILog with UUID 550e8400-e29b-41d4-a716-446655440000 does not exist."
 *               ticketNotFound:
 *                 summary: Ticket not found
 *                 value:
 *                   error: "VALIDATION_ERROR: Ticket with UUID 340a5679-ad90-4275-b082-7375698f08fb does not exist or has been deleted."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /powersuiteailogs/{powersuiteailogsuuid}:
 *   delete:
 *     summary: Delete a PowerSuite AI log
 *     tags: [PowerSuiteAILogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: powersuiteailogsuuid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: PowerSuite AI log UUID to delete
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: PowerSuite AI log deleted successfully
 *         content:
 *           application/json:
 *             example:
 *               powersuiteailogsuuid: "550e8400-e29b-41d4-a716-446655440000"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "VALIDATION_ERROR: PowerSuiteAILog with UUID 550e8400-e29b-41d4-a716-446655440000 does not exist."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */
