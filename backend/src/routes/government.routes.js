import { Router } from 'express';

import {
  getProjects,
  getMilestones,
  getEscalations,
  createEscalation,
  updateEscalation,
  scanEscalations,
  getAtRisk,
  getAudit,
  getHierarchy,
  assignProjectAuthority,
  getChallengeAuthority,
} from '../controllers/government.controller.js';
import { requireAuth, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

// All government routes require authentication and government or admin role
router.use(requireAuth, authorizeRoles('government', 'admin'));

router.get('/projects', getProjects);
router.patch('/projects/:id/assign-authority', assignProjectAuthority);
router.get('/milestones', getMilestones);
router.get('/escalations', getEscalations);
router.post('/escalations', createEscalation);
router.patch('/escalations/:id', updateEscalation);
router.post('/escalations/scan', scanEscalations);
router.get('/at-risk', getAtRisk);
router.get('/audit', getAudit);
router.get('/hierarchy', getHierarchy);
router.get('/challenges/:id/authority', getChallengeAuthority);

export default router;
