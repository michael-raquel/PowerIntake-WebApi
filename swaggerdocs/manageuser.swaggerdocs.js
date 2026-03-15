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

/**
 * @swagger
 * /manageusers/myteam:
 *   get:
 *     summary: Get paginated list of direct reports for a manager
 *     description: Returns users who directly report to the given manager, with ticket counts and status.
 *     tags:
 *       - Manage Users
 *     parameters:
 *       - in: query
 *         name: entrauserid
 *         required: true
 *         schema:
 *           type: string
 *         description: The Entra user ID of the manager
 *         example: f20bba97-984d-4218-a1f8-e88563764c24
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *         description: Records per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by username
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Active, Inactive]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Successfully retrieved team members
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
 *                       v_username:
 *                         type: string
 *                         example: John Doe
 *                       v_jobtitle:
 *                         type: string
 *                         example: Software Engineer
 *                       v_totalticket:
 *                         type: integer
 *                         example: 5
 *                       v_openticket:
 *                         type: integer
 *                         example: 2
 *                       v_status:
 *                         type: string
 *                         example: Active
 *                       total_count:
 *                         type: integer
 *                         example: 20
 *                 total:
 *                   type: integer
 *                   example: 20
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 12
 *                 totalPages:
 *                   type: integer
 *                   example: 2
 *                 hasNext:
 *                   type: boolean
 *                   example: true
 *                 hasPrev:
 *                   type: boolean
 *                   example: false
 *       400:
 *         description: Missing required parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: entrauserid is required
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

/**
 * @swagger
 * /manageusers/managercheck:
 *   get:
 *     summary: Check if a user is a manager
 *     description: Verifies whether the currently logged-in user is a manager based on their Entra User ID.
 *     tags:
 *       - Manage Users
 *     parameters:
 *       - in: query
 *         name: entrauserid
 *         schema:
 *           type: string
 *         required: true
 *         description: Entra User ID of the currently logged-in user
 *         example: 7f4a8d12-1234-4567-8910-abcdef123456
 *     responses:
 *       200:
 *         description: Successfully checked manager status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 manager_check:
 *                   type: boolean
 *                   description: Indicates whether the user is a manager
 *                   example: true
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