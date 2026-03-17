/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Microsoft Entra app role assignment management (requires AppRoleAssignment.ReadWrite.All)
 */

/**
 * @swagger
 * /roles/app-role-assignments:
 *   get:
 *     summary: Get app role assignments for a principal (user, group, or service principal)
 *     tags: [Roles]
 *     parameters:
 *       - in: query
 *         name: principalId
 *         required: true
 *         schema:
 *           type: string
 *         description: Object ID of the principal (user, group, or service principal)
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *       - in: query
 *         name: principalType
 *         required: false
 *         schema:
 *           type: string
 *           enum: [users, groups, servicePrincipals]
 *           default: users
 *         description: Type of the principal
 *     responses:
 *       200:
 *         description: Successfully retrieved app role assignments
 *         content:
 *           application/json:
 *             example:
 *               count: 1
 *               appRoleAssignments:
 *                 - id: "assignment-uuid"
 *                   appRoleId: "role-uuid"
 *                   resourceId: "app-service-principal-uuid"
 *                   resourceDisplayName: "powerintake"
 *                   principalId: "aabbccdd-1234-5678-abcd-ef1234567890"
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /roles/app-role-assignments:
 *   post:
 *     summary: Create an app role assignment for a principal
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - principalId
 *               - resourceId
 *               - appRoleId
 *             properties:
 *               principalId:
 *                 type: string
 *                 description: Object ID of the principal (user, group, or service principal)
 *                 example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *               resourceId:
 *                 type: string
 *                 description: Service principal object ID of the target application
 *                 example: "bbbbcccc-dddd-eeee-ffff-000011112222"
 *               appRoleId:
 *                 type: string
 *                 description: App role ID defined on the application
 *                 example: "99998888-7777-6666-5555-444433332222"
 *               principalType:
 *                 type: string
 *                 enum: [users, groups, servicePrincipals]
 *                 default: users
 *     responses:
 *       201:
 *         description: App role assignment created
 *         content:
 *           application/json:
 *             example:
 *               id: "assignment-uuid"
 *               appRoleId: "99998888-7777-6666-5555-444433332222"
 *               resourceId: "bbbbcccc-dddd-eeee-ffff-000011112222"
 *               principalId: "aabbccdd-1234-5678-abcd-ef1234567890"
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /roles/app-role-assignments/{principalId}/{assignmentId}:
 *   delete:
 *     summary: Delete an app role assignment from a principal
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: principalId
 *         required: true
 *         schema:
 *           type: string
 *         description: Principal object ID (user, group, or service principal)
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: App role assignment ID to delete
 *         example: "assignment-uuid"
 *       - in: query
 *         name: principalType
 *         required: false
 *         schema:
 *           type: string
 *           enum: [users, groups, servicePrincipals]
 *           default: users
 *         description: Type of the principal
 *     responses:
 *       200:
 *         description: App role assignment deleted
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "App role assignment deleted."
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 */
/**
 * @swagger
 * /roles/app-role-assignment:
 *   get:
 *     summary: Get the PowerIntake app role assignment for a specific principal
 *     description: >
 *       Returns the app role assignment for the PowerIntake application (service principal)
 *       for the given principalId. If the principal has no role assigned in PowerIntake,
 *       a 404 response is returned.
 *     tags: [Roles]
 *     parameters:
 *       - in: query
 *         name: principalId
 *         required: true
 *         schema:
 *           type: string
 *         description: Object ID of the principal (user, group, or service principal)
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: PowerIntake app role assignment for the principal
 *         content:
 *           application/json:
 *             example:
 *               principalId: "aabbccdd-1234-5678-abcd-ef1234567890"
 *               principalDisplayName: "John Doe"
 *               appRoleId: "99998888-7777-6666-5555-444433332222"
 *       400:
 *         description: Bad Request (e.g. principalId missing)
 *       404:
 *         description: No app role assigned to this principal in PowerIntake
 *       500:
 *         description: Internal Server Error
 * */