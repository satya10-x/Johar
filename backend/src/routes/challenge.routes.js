import { Router } from 'express';

import {
  create,
  list,
  mine,
  stats,
  nearby,
  areaSummary,
  getById,
  update,
  remove,
  analyze,
  checkDuplicates,
  validate,
  getValidations,
  removeOwnValidation,
  universityMatches,
  assignToUniversity,
  universityResponse,
} from '../controllers/challenge.controller.js';
import { requireAuth, authorizeRoles } from '../middleware/auth.middleware.js';
import {
  uploadChallengeMedia,
  handleUploadError,
} from '../middleware/upload.middleware.js';

const router = Router();

// Public routes
router.route('/').get(list).post(
  requireAuth,
  authorizeRoles('citizen', 'student', 'faculty', 'university', 'industry', 'admin'),
  uploadChallengeMedia,
  handleUploadError,
  create
);

// must be registered before '/:id' so 'mine'/'stats' are not treated as IDs
router.get('/mine', requireAuth, mine);
router.get('/stats', stats);
router.get('/nearby', nearby);
router.get('/summary', areaSummary);

router.route('/:id').get(getById);
router.get('/:id/validations', getValidations);

// Authenticated routes
router.use('/:id', requireAuth);

router
  .route('/:id')
  .patch(uploadChallengeMedia, handleUploadError, update)
  .delete(remove);

router.post('/:id/analyze', requireAuth, analyze);
router.post('/:id/check-duplicates', requireAuth, checkDuplicates);
router.post('/:id/validate', validate);
router.delete('/:id/validate', removeOwnValidation);
router.get('/:id/university-matches', requireAuth, universityMatches);
router.post('/:id/assign-university', requireAuth, assignToUniversity);
router.post('/:id/university-response', requireAuth, universityResponse);

export default router;
