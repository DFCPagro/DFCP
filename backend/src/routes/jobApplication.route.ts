// routes/jobApplication.route.ts
import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import validate from "../utils/validate";
import * as v from "../validations/jobApplication.validation";
import * as ctrl from "../controllers/jobApplication.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: JobApplications
 *   description: Manage job applications by role (deliverer, industrialDeliverer, farmer, picker, sorter)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     JobApplicationCreate:
 *       type: object
 *       required: [appliedRole, applicationData]
 *       properties:
 *         appliedRole:
 *           type: string
 *           enum: [deliverer, industrialDeliverer, farmer, picker, sorter]
 *         logisticCenterId:
 *           type: string
 *           nullable: true
 *           description: Optional logistic center assignment (MongoId)
 *         applicationData:
 *           type: object
 *           description: Role-specific payload (see examples)
 *       examples:
 *         deliverer:
 *           value:
 *             appliedRole: deliverer
 *             logisticCenterId: null
 *             applicationData:
 *               licenseType: "B"
 *               driverLicenseNumber: "DL-1234567"
 *               vehicleType: "van"
 *               vehicleYear: 2020
 *               weeklySchedule: [3,0,12,0,15,0,0]
 *         industrialDeliverer:
 *           value:
 *             appliedRole: industrialDeliverer
 *             applicationData:
 *               licenseType: "C1"
 *               driverLicenseNumber: "C1-998877"
 *               refrigerated: true
 *               weeklySchedule: [15,15,15,15,15,0,0]
 *         farmer:
 *           value:
 *             appliedRole: farmer
 *             applicationData:
 *               farmName: "Green Fields"
 *               agriculturalInsurance: true
 *               lands:
 *                 - name: "North Plot"
 *                   ownership: "owned"
 *                   acres: 3.5
 *                   pickupAddress:
 *                     address: "Moshav A, Field Gate 2"
 *                     latitude: 31.78
 *                     longitude: 35.22
 *         picker:
 *           value:
 *             appliedRole: picker
 *             applicationData: {}
 *         sorter:
 *           value:
 *             appliedRole: sorter
 *             applicationData: {}
 *
 *     JobApplicationDTO:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         user:
 *           oneOf:
 *             - type: string
 *             - type: object
 *               properties:
 *                 id: { type: string }
 *                 name: { type: string }
 *                 email: { type: string }
 *                 role: { type: string }
 *         appliedRole:
 *           type: string
 *           enum: [deliverer, industrialDeliverer, farmer, picker, sorter]
 *         logisticCenterId:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [pending, contacted, approved, denied]
 *         applicationData:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     PaginatedJobApplications:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/JobApplicationDTO'
 *         page: { type: integer, example: 1 }
 *         limit: { type: integer, example: 20 }
 *         total: { type: integer, example: 42 }
 */

/**
 * @swagger
 * /job-applications/create:
 *   post:
 *     summary: Create a new job application (applicant)
 *     description: One open application per role. Re-apply only after denied.
 *     tags: [JobApplications]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/JobApplicationCreate' }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JobApplicationDTO' }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       409: { description: Duplicate open application or user already holds this role }
 */
router.post(
  "/create",
  authenticate,
  ...v.create,
  validate,
  ctrl.create
);

/**
 * @swagger
 * /job-applications/mine:
 *   get:
 *     summary: List my job applications (applicant)
 *     tags: [JobApplications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [deliverer, industrialDeliverer, farmer, picker, sorter] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, contacted, approved, denied] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: ["-createdAt", "createdAt", "-updatedAt", "updatedAt"] }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedJobApplications' }
 *       401: { description: Unauthorized }
 */
router.get(
  "/mine",
  authenticate,
  ...v.mineQuery,
  validate,
  ctrl.mine
);

/**
 * @swagger
 * /job-applications/search:
 *   get:
 *     summary: List job applications (admin)
 *     tags: [JobApplications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [deliverer, industrialDeliverer, farmer, picker, sorter] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, contacted, approved, denied] }
 *       - in: query
 *         name: user
 *         schema: { type: string, description: "User id (MongoId)" }
 *       - in: query
 *         name: logisticCenterId
 *         schema: { type: string, description: "MongoId" }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: ["-createdAt","createdAt","-updatedAt","updatedAt","-status","status"] }
 *       - in: query
 *         name: includeUser
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedJobApplications' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get(
  "/search",
  authenticate,
  authorize("admin"),
  ...v.listQuery,
  validate,
  ctrl.listAll
);

/**
 * @swagger
 * /job-applications/{id}/details:
 *   get:
 *     summary: Get a job application by id (owner or admin)
 *     tags: [JobApplications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: includeUser
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JobApplicationDTO' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.get(
  "/:id/details",
  authenticate,
  ...v.idParam,
  validate,
  ctrl.read
);

/**
 * @swagger
 * /job-applications/{id}/update:
 *   patch:
 *     summary: Update applicationData (owner; allowed while pending/contacted)
 *     tags: [JobApplications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [applicationData]
 *             properties:
 *               applicationData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JobApplicationDTO' }
 *       400: { description: Validation error or invalid status for edit }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.patch(
  "/:id/update",
  authenticate,
  ...v.patchApplication,
  validate,
  ctrl.patchApplication
);

/**
 * @swagger
 * /job-applications/{id}/status:
 *   patch:
 *     summary: Change application status (admin)
 *     tags: [JobApplications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, contacted, approved, denied]
 *               note:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JobApplicationDTO' }
 *       400: { description: Invalid transition }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.patch(
  "/:id/status",
  authenticate,
  authorize("admin"),
  ...v.patchStatus,
  validate,
  ctrl.patchStatusCtrl
);

/**
 * @swagger
 * /job-applications/{id}/meta:
 *   patch:
 *     summary: Update admin metadata (e.g., logisticCenterId) (admin)
 *     tags: [JobApplications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               logisticCenterId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JobApplicationDTO' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.patch(
  "/:id/meta",
  authenticate,
  authorize("admin"),
  ...v.patchMeta,
  validate,
  ctrl.patchMetaCtrl
);

export default router;
