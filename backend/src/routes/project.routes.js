import { Router } from 'express';

import {
  create,
  list,
  getById,
  update,
  remove,
  changeStatus,
  addMember,
  deleteMember,
  setMentor,
  industryMatches,
  createCollabRequest,
  getCollabRequests,
  respondToRequest,
  createFunding,
  createNewMilestone,
  getAllMilestones,
  patchMilestone,
  removeMilestone,
  getImpact,
  createImpact,
  patchImpact,
  generateImpactSummary,
  replicationOpportunities,
  analyzeRisk,
  getRisk,
  getRiskSummary,
} from '../controllers/project.controller.js';
import { requireAuth, authorizeRoles } from '../middleware/auth.middleware.js';
import { optionalAuth } from '../middleware/optionalAuth.middleware.js';

const router = Router();

router
  .route('/')
  .get(list)
  .post(requireAuth, authorizeRoles('faculty', 'university', 'admin'), create);

// Risk summary endpoint MUST precede /:id to avoid being captured as an ID
router.get('/risk-summary', requireAuth, getRiskSummary);

router.get('/:id', optionalAuth, getById);

// authenticated project actions
router.patch('/:id', requireAuth, update);
router.delete('/:id', requireAuth, remove);
router.patch('/:id/status', requireAuth, changeStatus);
router.post('/:id/team', requireAuth, addMember);
router.delete('/:id/team/:userId', requireAuth, deleteMember);
router.patch('/:id/mentor', requireAuth, setMentor);
router.get('/:id/industry-matches', requireAuth, industryMatches);
router.post('/:id/collaboration-request', requireAuth, createCollabRequest);
router.get('/:id/collaboration-requests', requireAuth, getCollabRequests);
router.post('/:id/funding', requireAuth, createFunding);

// milestones
router.get('/:id/milestones', getAllMilestones);
router.post('/:id/milestones', requireAuth, createNewMilestone);

// social impact
router.get('/:id/impact', optionalAuth, getImpact);
router.post('/:id/impact', requireAuth, createImpact);
router.patch('/:id/impact', requireAuth, patchImpact);
router.post('/:id/impact/summary', requireAuth, generateImpactSummary);
router.get('/:id/replication-opportunities', optionalAuth, replicationOpportunities);

// AI-assisted project risk detection
router.post('/:id/risk-analysis', requireAuth, analyzeRisk);
router.get('/:id/risk-analysis', requireAuth, getRisk);

export default router;
