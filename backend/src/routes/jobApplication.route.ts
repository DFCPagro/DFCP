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
 *           format: objectId
 *           nullable: true
 *           description: Optional logistic center assignment (Mongo ObjectId)
 *         applicationData:
 *           type: object
 *           description: Role-specific payload (free-form by role)
 *         notes:
 *           type: string
 *           maxLength: 1000
 *         contactEmail:
 *           type: string
 *           format: email
 *         contactPhone:
 *           type: string
 *           description: E.164 or local phone, 6–30 chars
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
 *           format: objectId
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
 * /job-applications:
 *   post:
 *     summary: Create a new job application (applicant)
 *     description: Starts in 'pending'. One open application per role per user is recommended.
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
  "/",
  authenticate,
  ...v.createJobApplicationValidation,
  validate,
  ctrl.create
);

/**
 * @swagger
 * /job-applications/admin:
 *   get:
 *     summary: List job applications (admin/staff)
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
 *         schema:
 *           type: string
 *           format: objectId
 *           description: Filter by applicant user id
 *       - in: query
 *         name: logisticCenterId
 *         schema:
 *           type: string
 *           format: objectId
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
 *         schema:
 *           type: string
 *           enum: ["-createdAt","createdAt","-updatedAt","updatedAt","-status","status"]
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
  "/admin",
  authenticate,
  authorize("admin"),
  ...v.adminListJobApplicationsValidation,
  validate,
  ctrl.adminList
);

/**
 * @swagger
 * /job-applications/admin/{id}:
 *   get:
 *     summary: Get a job application by id (admin/staff)
 *     tags: [JobApplications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: objectId }
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
  "/admin/:id",
  authenticate,
  authorize("admin"),
  ...v.idParamValidation,
  validate,
  ctrl.adminRead
);

/**
 * @swagger
 * /job-applications/admin/{id}/status:
 *   patch:
 *     summary: Change application status (admin/staff)
 *     description: Valid transitions: pending→contacted/approved/denied; contacted→approved/denied.
 *     tags: [JobApplications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: objectId }
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
 *               reviewerNotes:
 *                 type: string
 *                 maxLength: 2000
 *               contactedAt:
 *                 type: string
 *                 format: date-time
 *               approvedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JobApplicationDTO' }
 *       400: { description: Invalid transition or validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.patch(
  "/admin/:id/status",
  authenticate,
  authorize("admin"),
  ...v.adminStatusUpdateValidation,
  validate,
  ctrl.adminPatchStatus
);

/**
 * @swagger
 * /job-applications/admin/{id}:
 *   patch:
 *     summary: Update non-status fields (admin/staff)
 *     description: Use this to edit metadata like logisticCenterId, notes, contact info, or appliedRole. Use /{id}/status to change status.
 *     tags: [JobApplications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: objectId }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               logisticCenterId:
 *                 type: string
 *                 format: objectId
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *               contactEmail:
 *                 type: string
 *                 format: email
 *               contactPhone:
 *                 type: string
 *               appliedRole:
 *                 type: string
 *                 enum: [deliverer, industrialDeliverer, farmer, picker, sorter]
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
  "/admin/:id",
  authenticate,
  authorize("admin"),
  ...v.adminUpdateJobApplicationValidation,
  validate,
  ctrl.adminPatchMeta
);

export default router;
