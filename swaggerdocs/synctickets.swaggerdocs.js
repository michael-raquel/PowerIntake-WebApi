/**
 * @swagger
 * tags:
 *   name: Ticket Sync
 *   description: Dynamics ticket sync endpoints
 */

/**
 * @swagger
 * /synctickets/clients:
 *   post:
 *     summary: Sync all Dynamics tickets modified today (all clients)
 *     tags: [Ticket Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Tickets synced
 *                 value:
 *                   message: "Dynamics ticket sync completed."
 *                   total: 21
 *                   filtered: 21
 *                   synced: 21
 *                   skipped: 0
 *               noTickets:
 *                 summary: No eligible tickets found
 *                 value:
 *                   message: "No eligible tickets found."
 *                   synced: 0
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Failed to sync tickets from Dynamics"
 *               details: "Error message here"
 */

/**
 * @swagger
 * /synctickets/company:
 *   post:
 *     summary: Sync Dynamics tickets modified today filtered by company (tenantid)
 *     tags: [Ticket Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantid
 *         required: true
 *         schema:
 *           type: string
 *         description: The tenantid of the company to sync tickets for
 *         example: "42"
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Tickets synced
 *                 value:
 *                   message: "Company ticket sync completed."
 *                   total: 21
 *                   filtered: 5
 *                   synced: 5
 *                   skipped: 0
 *               noTickets:
 *                 summary: No tickets found for this company
 *                 value:
 *                   message: "No tickets found for this company."
 *                   synced: 0
 *               noEligible:
 *                 summary: No eligible tickets found
 *                 value:
 *                   message: "No eligible tickets found."
 *                   synced: 0
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "tenantid is required"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Failed to sync tickets by company"
 *               details: "Error message here"
 */

/**
 * @swagger
 * /synctickets/team:
 *   post:
 *     summary: Sync Dynamics tickets modified today filtered by manager's team
 *     tags: [Ticket Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: managerid
 *         required: true
 *         schema:
 *           type: string
 *         description: The entrauserid of the manager whose team tickets to sync
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Tickets synced
 *                 value:
 *                   message: "Team ticket sync completed."
 *                   total: 21
 *                   filtered: 8
 *                   synced: 8
 *                   skipped: 0
 *               noTeam:
 *                 summary: No team members found
 *                 value:
 *                   message: "No team members found for this manager."
 *                   synced: 0
 *               noTickets:
 *                 summary: No tickets found for this team
 *                 value:
 *                   message: "No tickets found for this team."
 *                   synced: 0
 *               noEligible:
 *                 summary: No eligible tickets found
 *                 value:
 *                   message: "No eligible tickets found."
 *                   synced: 0
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "managerid is required"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Failed to sync tickets by team"
 *               details: "Error message here"
 */

/**
 * @swagger
 * /synctickets/user:
 *   post:
 *     summary: Sync Dynamics tickets modified today filtered by user
 *     tags: [Ticket Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entrauserid
 *         required: true
 *         schema:
 *           type: string
 *         description: The Azure AD user ID (entrauserid) of the user whose tickets to sync
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Tickets synced
 *                 value:
 *                   message: "User ticket sync completed."
 *                   total: 21
 *                   filtered: 3
 *                   synced: 3
 *                   skipped: 0
 *               noTickets:
 *                 summary: No tickets found for this user
 *                 value:
 *                   message: "No tickets found for this user."
 *                   synced: 0
 *               noEligible:
 *                 summary: No eligible tickets found
 *                 value:
 *                   message: "No eligible tickets found."
 *                   synced: 0
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "entrauserid is required"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             example:
 *               error: "User not found."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Failed to sync tickets by user"
 *               details: "Error message here"
 */