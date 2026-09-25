import { Router } from 'express';

import { patchMilestone, removeMilestone } from '../controllers/project.controller.js';
import {
  submitForVerification,
  getEvidence,
  addEvidence,
  verifyMilestone,
  requestChanges,
  rejectMilestone,
} from '../controllers/milestone.controller.js';
import { requireAuth, optionalAuth, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

// Verification and Evidence Workflow
router.post('/:id/submit-for-verification', requireAuth, submitForVerification);
router.get('/:id/evidence', optionalAuth, getEvidence);
router.post('/:id/evidence', requireAuth, addEvidence);
router.post('/:id/verify', requireAuth, authorizeRoles('government', 'admin'), verifyMilestone);
router.post(
  '/:id/request-changes',
  requireAuth,
  authorizeRoles('government', 'admin'),
  requestChanges
);
router.post('/:id/reject', requireAuth, authorizeRoles('government', 'admin'), rejectMilestone);

// Original PATCH/DELETE milestone routes preserved for backward compatibility
router.patch('/:milestoneId', requireAuth, patchMilestone);
router.delete('/:milestoneId', requireAuth, removeMilestone);

export default router;
