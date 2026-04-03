/**
 * @swagger
 * tags:
 *   name: Tenants
 *   description: Tenant management endpoints
 */

/**
 * @swagger
 * /tenants:
 *   get:
 *     summary: Get tenants with optional filters
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantid
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter by tenant ID
 *         example: 1
 *       - in: query
 *         name: entratenantid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by Entra tenant ID
 *         example: "1159156a-3971-429d-bb02-bd37b1223d24"
 *       - in: query
 *         name: dynamicsaccountid
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by Dynamics account ID
 *         example: "5f00ecfd-7fd2-f011-8c4d-7c1e520d4978"
 *       - in: query
 *         name: isconsented
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Filter by consent status
 *         example: true
 *       - in: query
 *         name: isactive
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *         example: true
 *     responses:
 *       200:
 *         description: Successfully retrieved tenants
 *         content:
 *           application/json:
 *             example:
 *               - tenantid: 1
 *                 tenantuuid: "550e8400-e29b-41d4-a716-446655440000"
 *                 entratenantid: "1159156a-3971-429d-bb02-bd37b1223d24"
 *                 tenantname: "Contoso Philippines"
 *                 tenantemail: "admin@contoso.ph"
 *                 createdat: "2026-04-02T07:34:12.123Z"
 *                 createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *                 dynamicsaccountid: "5f00ecfd-7fd2-f011-8c4d-7c1e520d4978"
 *                 admingroupid: "group-id-value"
 *                 usergroupid: "user-group-id-value"
 *                 isconsented: true
 *                 isactive: true
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             examples:
 *               invalidTenantId:
 *                 summary: Invalid tenantid type
 *                 value:
 *                   error: "VALIDATION_ERROR: tenantid must be a number"
 *               invalidBoolean:
 *                 summary: Invalid boolean value
 *                 value:
 *                   error: "VALIDATION_ERROR: isconsented must be true or false"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized: No token provided"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

/**
 * @swagger
 * /tenants:
 *   post:
 *     summary: Create a tenant
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             entratenantid: "1159156a-3971-429d-bb02-bd37b1223d24"
 *             tenantname: "Contoso Philippines"
 *             tenantemail: "admin@contoso.ph"
 *             createdby: "aabbccdd-1234-5678-abcd-ef1234567890"
 *             dynamicsaccountid: "5f00ecfd-7fd2-f011-8c4d-7c1e520d4978"
 *             admingroupid: "group-id-value"
 *             usergroupid: "user-group-id-value"
 *     responses:
 *       201:
 *         description: Successfully created, returns tenant UUID
 *         content:
 *           application/json:
 *             example:
 *               tenantuuid: "550e8400-e29b-41d4-a716-446655440000"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             examples:
 *               duplicateTenant:
 *                 summary: Tenant already exists
 *                 value:
 *                   error: "VALIDATION_ERROR: Tenant with EntraTenantID 1159156a-3971-429d-bb02-bd37b1223d24 already exists."
 *               duplicateDynamicsAccount:
 *                 summary: Dynamics account already exists
 *                 value:
 *                   error: "VALIDATION_ERROR: DynamicsAccountID 5f00ecfd-7fd2-f011-8c4d-7c1e520d4978 already exists."
 *               missingFields:
 *                 summary: Required fields are missing
 *                 value:
 *                   error: "entratenantid and tenantname are required"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized: No token provided"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */