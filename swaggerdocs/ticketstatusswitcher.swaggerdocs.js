/**
 * @swagger
 * tags:
 *   name: Ticket Status
 *   description: Ticket status management (Cancel / Resolve)
 */

/**
 * @swagger
 * /ticketstatusswitcher/cancel:
 *   post:
 *     summary: Cancel a ticket in Dynamics
 *     tags: [Ticket Status]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             ticketuuid: "123e4567-e89b-12d3-a456-426614174000"
 *             createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Ticket cancelled successfully
 *         content:
 *           application/json:
 *             example:
 *               message: "Ticket cancelled successfully"
 *               dynamicsIncidentId: "e239d99e-772f-f111-88b4-00224802fa47"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "ticketuuid is required"
 *       404:
 *         description: Ticket not found in Dynamics
 *         content:
 *           application/json:
 *             example:
 *               error: "No Dynamics incident linked to this ticket"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized: No token provided"
 *       500:
 *         description: Failed to cancel ticket in Dynamics
 *         content:
 *           application/json:
 *             example:
 *               error: "Failed to cancel ticket in Dynamics"
 */

/**
 * @swagger
 * /ticketstatusswitcher/resolve:
 *   post:
 *     summary: Resolve a ticket in Dynamics
 *     tags: [Ticket Status]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             ticketuuid: "123e4567-e89b-12d3-a456-426614174000"
 *             createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *             resolution: "Issue has been fixed"
 *     responses:
 *       200:
 *         description: Ticket resolved successfully
 *         content:
 *           application/json:
 *             example:
 *               message: "Ticket resolved successfully"
 *               dynamicsIncidentId: "e239d99e-772f-f111-88b4-00224802fa47"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "ticketuuid is required"
 *       404:
 *         description: Ticket not found in Dynamics
 *         content:
 *           application/json:
 *             example:
 *               error: "No Dynamics incident linked to this ticket"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized: No token provided"
 *       500:
 *         description: Failed to resolve ticket in Dynamics
 *         content:
 *           application/json:
 *             example:
 *               error: "Failed to resolve ticket in Dynamics"
 */