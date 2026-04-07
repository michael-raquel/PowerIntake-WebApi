/**
 * @swagger
 * tags:
 *   name: UserSettings
 *   description: User settings management endpoints
 */
 
/**
 * @swagger
 * /usersettings:
 *   get:
 *     summary: Get user settings (all, by user UUID, or by EntraUserID)
 *     tags: [UserSettings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: useruuid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by user UUID
 *         example: "340a5679-ad90-4275-b082-7375698f08fb"
 *       - in: query
 *         name: entrauserid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by Entra User ID
 *         example: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully retrieved user settings
 *         content:
 *           application/json:
 *             example:
 *               - v_usersettingsid: 1
 *                 v_usersettingsuuid: "550e8400-e29b-41d4-a716-446655440000"
 *                 v_userid: 1
 *                 v_useruuid: "340a5679-ad90-4275-b082-7375698f08fb"
 *                 v_entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 v_username: "John Doe"
 *                 v_useremail: "john.doe@sparta.com"
 *                 v_outlook: true
 *                 v_teams: true
 *                 v_powersuiteai: false
 *                 v_spartaassist: true
 *                 v_darkmode: false
 *                 v_createdat: "2026-01-01T09:00:00Z"
 *                 v_createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 v_modifiedat: null
 *                 v_modifiedby: null
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */
 
/**
 * @swagger
 * /usersettings:
 *   post:
 *     summary: Create user settings
 *     tags: [UserSettings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *             outlook: "true"
 *             teams: "true"
 *             powersuiteai: "false"
 *             spartaassist: "true"
 *             darkmode: "false"
 *             createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       201:
 *         description: Successfully created, returns new user settings UUID
 *         content:
 *           application/json:
 *             example:
 *               usersettingsuuid: "550e8400-e29b-41d4-a716-446655440000"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             examples:
 *               userNotFound:
 *                 summary: User does not exist
 *                 value:
 *                   error: "VALIDATION_ERROR: User with EntraUserID aabbccdd-1234-5678-abcd-ef1234567890 does not exist."
 *               alreadyExists:
 *                 summary: UserSettings already exists for this user
 *                 value:
 *                   error: "VALIDATION_ERROR: UserSettings for EntraUserID aabbccdd-1234-5678-abcd-ef1234567890 already exists."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */
 
/**
 * @swagger
 * /usersettings:
 *   put:
 *     summary: Update user settings
 *     tags: [UserSettings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             usersettingsuuid: "550e8400-e29b-41d4-a716-446655440000"
 *             outlook: "false"
 *             teams: "true"
 *             powersuiteai: "true"
 *             spartaassist: "false"
 *             darkmode: "true"
 *             modifiedby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Successfully updated, returns user settings UUID
 *         content:
 *           application/json:
 *             example:
 *               usersettings_update: "550e8400-e29b-41d4-a716-446655440000"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "VALIDATION_ERROR: UserSettings with UUID 550e8400-e29b-41d4-a716-446655440000 does not exist."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /usersettings/record-counts:
 *   patch:
 *     summary: Update user settings record counts
 *     tags: [UserSettings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *             ticketrecordcount: "50"
 *             managerecordcount: "25"
 *             tenantrecordcount: "20"
 *             modifiedby: "Jasper Manalo"
 *     responses:
 *       200:
 *         description: Successfully updated record counts
 *         content:
 *           application/json:
 *             example:
 *               message: "Record counts updated successfully"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "VALIDATION_ERROR: User with EntraUserID aabbccdd-1234-5678-abcd-ef1234567890 does not exist."
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */
 
/**
 * @swagger
 * /usersettings/hide-completed-tickets:
 *   patch:
 *     summary: Update hide completed tickets setting for a user
 *     tags: [UserSettings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             entrauserid: "aabbccdd-1234-5678-abcd-ef1234567890"
 *             hidecompletedtickets: "true"
 *             modifiedby: "999e4567-e89b-12d3-a456-426614174999"
 *     responses:
 *       200:
 *         description: Successfully updated hide completed tickets setting
 *         content:
 *           application/json:
 *             example:
 *               message: "Hide completed tickets setting updated successfully"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             example:
 *               error: "VALIDATION_ERROR: EntraUserID is required or invalid"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */