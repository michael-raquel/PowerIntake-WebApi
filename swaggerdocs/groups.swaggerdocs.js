/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Microsoft 365 group management endpoints
 */

/**
 * @swagger
 * /groups:
 *   get:
 *     summary: Get all groups
 *     tags: [Groups]
 *     responses:
 *       200:
 *         description: Successfully retrieved all groups
 *         content:
 *           application/json:
 *             example:
 *               count: 2
 *               groups:
 *                 - id: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                   displayName: "Engineering Team"
 *                   description: "All engineers"
 *                   mail: "engineering@sparta.com"
 *                   mailEnabled: true
 *                   securityEnabled: false
 *                   groupTypes: ["Unified"]
 *                   createdDateTime: "2024-01-01T00:00:00Z"
 *                   visibility: "Public"
 *       504:
 *         description: Timeout or Network Issue
 *         content:
 *           application/json:
 *             example:
 *               error: "No response from Microsoft Graph (Timeout or Network Issue)"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /groups/find:
 *   get:
 *     summary: Get a group by ID
 *     tags: [Groups]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved group
 *         content:
 *           application/json:
 *             example:
 *               id: "aabbccdd-1234-5678-abcd-ef1234567890"
 *               displayName: "Engineering Team"
 *               description: "All engineers"
 *               mail: "engineering@sparta.com"
 *               mailEnabled: true
 *               securityEnabled: false
 *               groupTypes: ["Unified"]
 *               createdDateTime: "2024-01-01T00:00:00Z"
 *               visibility: "Public"
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /groups/members:
 *   get:
 *     summary: Get members of a group
 *     tags: [Groups]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved group members
 *         content:
 *           application/json:
 *             example:
 *               count: 2
 *               members:
 *                 - id: "user-uuid-001"
 *                   displayName: "John Doe"
 *                   mail: "john.doe@sparta.com"
 *                   userPrincipalName: "john.doe@sparta.com"
 *                   jobTitle: "Software Engineer"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /groups/owners:
 *   get:
 *     summary: Get owners of a group
 *     tags: [Groups]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved group owners
 *         content:
 *           application/json:
 *             example:
 *               count: 1
 *               owners:
 *                 - id: "user-uuid-001"
 *                   displayName: "Jane Smith"
 *                   mail: "jane.smith@sparta.com"
 *                   userPrincipalName: "jane.smith@sparta.com"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /groups/profile:
 *   get:
 *     summary: Get full profile of a group (group + members + owners)
 *     tags: [Groups]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved full group profile
 *         content:
 *           application/json:
 *             example:
 *               group:
 *                 id: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 displayName: "Engineering Team"
 *                 description: "All engineers"
 *                 mail: "engineering@sparta.com"
 *               members:
 *                 - id: "user-uuid-001"
 *                   displayName: "John Doe"
 *                   mail: "john.doe@sparta.com"
 *                   jobTitle: "Software Engineer"
 *               owners:
 *                 - id: "user-uuid-002"
 *                   displayName: "Jane Smith"
 *                   mail: "jane.smith@sparta.com"
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /groups/with-members:
 *   get:
 *     summary: Get all groups with their members and owners
 *     tags: [Groups]
 *     responses:
 *       200:
 *         description: Successfully retrieved all groups with members and owners
 *         content:
 *           application/json:
 *             example:
 *               count: 2
 *               groups:
 *                 - id: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                   displayName: "Engineering Team"
 *                   memberCount: 2
 *                   members:
 *                     - id: "user-uuid-001"
 *                       displayName: "John Doe"
 *                       mail: "john.doe@sparta.com"
 *                       jobTitle: "Software Engineer"
 *                       department: "Engineering"
 *                   owners:
 *                     - id: "user-uuid-002"
 *                       displayName: "Jane Smith"
 *                       mail: "jane.smith@sparta.com"
 *       504:
 *         description: Timeout or Network Issue
 *         content:
 *           application/json:
 *             example:
 *               error: "No response from Microsoft Graph (Timeout or Network Issue)"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /groups/assign:
 *   post:
 *     summary: Add a user to a Microsoft 365 group
 *     description: |
 *       Adds the specified user (by Entra ID objectId) as a member of the specified group.
 *       This endpoint requires a valid bearer token. The backend calls Microsoft Graph using application permissions (client credentials flow).
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userOid
 *               - groupId
 *             properties:
 *               userOid:
 *                 type: string
 *                 description: Entra ID (Azure AD) objectId of the user to add.
 *                 example: "11111111-2222-3333-4444-555555555555"
 *               groupId:
 *                 type: string
 *                 description: Entra ID (Azure AD) objectId of the target group.
 *                 example: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
 *     responses:
 *       201:
 *         description: User successfully added to the group
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *       400:
 *         description: Missing or invalid input
 *         content:
 *           application/json:
 *             example:
 *               error: "userOid and groupId are required"
 *       401:
 *         description: Unauthorized – no or invalid bearer token
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized"
 *       403:
 *         description: Forbidden – Microsoft Graph denied the operation (for example, app has insufficient Graph permissions)
 *         content:
 *           application/json:
 *             example:
 *               error: "Insufficient privileges to complete the operation."
 *       504:
 *         description: Timeout or Network Issue calling Microsoft Graph
 *         content:
 *           application/json:
 *             example:
 *               error: "No response from Microsoft Graph (Timeout or Network Issue)"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /groups/user-groups/{userOid}/{clientId}:
 *   get:
 *     summary: Get groups for a user by app roles on a specific app
 *     description: |
 *       For the given user and clientId (appId), returns each app role the user has on that app and the groups assigned to the same roles.
 *     tags: [Groups]
 *     parameters:
 *       - in: path
 *         name: userOid
 *         required: true
 *         schema:
 *           type: string
 *         description: The Entra ID (Azure AD) objectId of the user.
 *         example: "11111111-2222-3333-4444-555555555555"
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: The application (client) ID of the app registration.
 *         example: "00000000-1111-2222-3333-444444444444"
 *     responses:
 *       200:
 *         description: Successfully retrieved roles and their assigned groups for the user on the app
 *         content:
 *           application/json:
 *             example:
 *               userOid: "11111111-2222-3333-4444-555555555555"
 *               clientId: "00000000-1111-2222-3333-444444444444"
 *               servicePrincipalId: "sp-uuid-1234"
 *               roles:
 *                 - appRoleId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
 *                   appRoleAssignmentId: "99999999-8888-7777-6666-555555555555"
 *                   groups:
 *                     - groupId: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                       groupDisplayName: "Engineering Team"
 *       400:
 *         description: Missing or invalid input
 *         content:
 *           application/json:
 *             example:
 *               error: "userOid and clientId are required"
 *       404:
 *         description: Service principal not found or user has no app role assignments for this app
 *         content:
 *           application/json:
 *             examples:
 *               servicePrincipalNotFound:
 *                 summary: Service principal not found
 *                 value:
 *                   error: "Service principal not found for the given clientId"
 *               noAssignments:
 *                 summary: User has no roles on this app
 *                 value:
 *                   error: "User has no app role assignments for this app"
 *       504:
 *         description: Timeout or Network Issue calling Microsoft Graph
 *         content:
 *           application/json:
 *             example:
 *               error: "No response from Microsoft Graph (Timeout or Network Issue)"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /groups/app-roles/{appId}:
 *   get:
 *     summary: Get app roles for an app registration
 *     description: |
 *       Returns the enabled app roles (application roles) defined on a specific Entra ID (Azure AD) app registration.
 *     tags: [Groups]
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: The application (client) ID of the app registration.
 *         example: "00000000-1111-2222-3333-444444444444"
 *     responses:
 *       200:
 *         description: Successfully retrieved enabled app roles
 *         content:
 *           application/json:
 *             example:
 *               appId: "00000000-1111-2222-3333-444444444444"
 *               displayName: "My API App"
 *               appRoles:
 *                 - appRoleId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
 *                   displayName: "Admin"
 *                   value: "Admin"
 *                   description: "Administrators with full access."
 *                   allowedMemberTypes: ["User", "Application"]
 *       400:
 *         description: Missing or invalid input
 *         content:
 *           application/json:
 *             example:
 *               error: "appId is required"
 *       404:
 *         description: App registration not found
 *         content:
 *           application/json:
 *             example:
 *               error: "App registration not found"
 *       504:
 *         description: Timeout or Network Issue calling Microsoft Graph
 *         content:
 *           application/json:
 *             example:
 *               error: "No response from Microsoft Graph (Timeout or Network Issue)"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /groups/app-roles-with-groups/{clientId}:
 *   get:
 *     summary: Get app roles for an app registration, including assigned groups
 *     description: |
 *       For the given clientId (application ID), returns each enabled app role on the app registration
 *       and the groups that have that app role assigned via the corresponding service principal.
 *     tags: [Groups]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: The application (client) ID of the app registration.
 *         example: "00000000-1111-2222-3333-444444444444"
 *     responses:
 *       200:
 *         description: Successfully retrieved app roles and their assigned groups
 *         content:
 *           application/json:
 *             example:
 *               clientId: "00000000-1111-2222-3333-444444444444"
 *               displayName: "My API App"
 *               servicePrincipalId: "sp-uuid-1234"
 *               appRoles:
 *                 - appRoleId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
 *                   displayName: "Admin"
 *                   value: "Admin"
 *                   description: "Administrators with full access."
 *                   allowedMemberTypes: ["User", "Application"]
 *                   groups:
 *                     - groupId: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                       groupDisplayName: "Engineering Team"
 *       400:
 *         description: Missing or invalid input
 *         content:
 *           application/json:
 *             example:
 *               error: "clientId is required"
 *       404:
 *         description: App registration or service principal not found
 *         content:
 *           application/json:
 *             examples:
 *               appNotFound:
 *                 summary: App registration not found
 *                 value:
 *                   error: "App registration not found"
 *               spNotFound:
 *                 summary: Service principal not found for clientId
 *                 value:
 *                   error: "Service principal not found for the given clientId"
 *       504:
 *         description: Timeout or Network Issue calling Microsoft Graph
 *         content:
 *           application/json:
 *             example:
 *               error: "No response from Microsoft Graph (Timeout or Network Issue)"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /groups/unassign:
 *   delete:
 *     summary: Remove a user from a Microsoft 365 group
 *     description: |
 *       Removes the specified user (by Entra ID objectId) as a member of the specified group.
 *       This endpoint requires a valid bearer token. The backend calls Microsoft Graph using application permissions (client credentials flow).
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userOid
 *               - groupId
 *             properties:
 *               userOid:
 *                 type: string
 *                 description: Entra ID (Azure AD) objectId of the user to remove.
 *                 example: "11111111-2222-3333-4444-555555555555"
 *               groupId:
 *                 type: string
 *                 description: Entra ID (Azure AD) objectId of the target group.
 *                 example: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
 *     responses:
 *       200:
 *         description: User successfully removed from the group
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *       400:
 *         description: Missing or invalid input
 *         content:
 *           application/json:
 *             example:
 *               error: "userOid and groupId are required"
 *       401:
 *         description: Unauthorized – no or invalid bearer token
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized"
 *       403:
 *         description: Forbidden – Microsoft Graph denied the operation (for example, app has insufficient Graph permissions)
 *         content:
 *           application/json:
 *             example:
 *               error: "Insufficient privileges to complete the operation."
 *       504:
 *         description: Timeout or Network Issue calling Microsoft Graph
 *         content:
 *           application/json:
 *             example:
 *               error: "No response from Microsoft Graph (Timeout or Network Issue)"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */
