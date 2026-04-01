/**
 * @swagger
 * tags:
 *   name: Technicians
 *   description: Technician management endpoints
 */

/**
 * @swagger
 * /technicians:
 *   get:
 *     summary: Get ticket technicians (optionally filtered by ticket UUID)
 *     tags: [Technicians]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ticketuuid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter technicians by ticket UUID
 *         example: "de693890-c3ec-42f9-905e-c3d083405c5e"
 *     responses:
 *       200:
 *         description: Successfully retrieved ticket technicians
 *         content:
 *           application/json:
 *             example:
 *               - v_tickettechnicianid: 1
 *                 v_ticketid: 101
 *                 v_ticketuuid: "de693890-c3ec-42f9-905e-c3d083405c5e"
 *                 v_ticketnumber: "TCK-00123"
 *                 v_technicianid: "tech-123"
 *                 v_technicianname: "John Doe"
 *                 v_createdat: "2026-01-01T09:00:00Z"
 *                 v_createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */