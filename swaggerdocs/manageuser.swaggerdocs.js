/**
 * @swagger
 * /manageusers/mycompany:
 *   get:
 *     summary: Get paginated list of users in my company
 *     description: Returns a paginated list of users with their manager, role, department, total tickets, open tickets, and status.
 *     tags:
 *       - Manage Users
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         required: false
 *         description: Page number to retrieve
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         required: false
 *         description: Number of records per page
 *         example: 10
 *     responses:
 *       200:
 *         description: Successfully retrieved paginated users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       v_managername:
 *                         type: string
 *                         example: John Smith
 *                       v_username:
 *                         type: string
 *                         example: Jane Doe
 *                       v_role:
 *                         type: string
 *                         example: Software Engineer
 *                       v_department:
 *                         type: string
 *                         example: Engineering
 *                       v_totalticket:
 *                         type: integer
 *                         example: 7
 *                       v_openticket:
 *                         type: integer
 *                         example: 3
 *                       v_status:
 *                         type: string
 *                         example: Active
 *                       total_count:
 *                         type: integer
 *                         example: 100
 *                 total:
 *                   type: integer
 *                   description: Total number of records
 *                   example: 100
 *                 page:
 *                   type: integer
 *                   description: Current page number
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   description: Number of records per page
 *                   example: 10
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages
 *                   example: 10
 *                 hasNext:
 *                   type: boolean
 *                   description: Whether there is a next page
 *                   example: true
 *                 hasPrev:
 *                   type: boolean
 *                   description: Whether there is a previous page
 *                   example: false
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal Server Error
 */