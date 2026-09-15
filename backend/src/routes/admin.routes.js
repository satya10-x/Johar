import { Router } from 'express';

import {
  dashboard,
  challengeAnalytics,
  priorityChallenges,
  universityAnalytics,
  industryAnalytics,
  projectAnalytics,
  fundingAnalytics,
  communityAnalytics,
  districtAnalytics,
} from '../controllers/admin.controller.js';
import { requireAuth, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

// only government officials and platform admins may access analytics
const GOVERNMENT_ACCESS = [requireAuth, authorizeRoles('government', 'admin')];

router.get('/dashboard', ...GOVERNMENT_ACCESS, dashboard);

router.get('/analytics/challenges', ...GOVERNMENT_ACCESS, challengeAnalytics);
router.get('/analytics/priority-challenges', ...GOVERNMENT_ACCESS, priorityChallenges);
router.get('/analytics/universities', ...GOVERNMENT_ACCESS, universityAnalytics);
router.get('/analytics/industries', ...GOVERNMENT_ACCESS, industryAnalytics);
router.get('/analytics/projects', ...GOVERNMENT_ACCESS, projectAnalytics);
router.get('/analytics/funding', ...GOVERNMENT_ACCESS, fundingAnalytics);
router.get('/analytics/community', ...GOVERNMENT_ACCESS, communityAnalytics);
router.get('/analytics/districts', ...GOVERNMENT_ACCESS, districtAnalytics);

export default router;
