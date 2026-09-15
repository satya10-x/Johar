import { Router } from 'express';

import { patchMilestone, removeMilestone } from '../controllers/project.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// PATCH/DELETE /api/milestones/:id
router.patch('/:milestoneId', requireAuth, patchMilestone);
router.delete('/:milestoneId', requireAuth, removeMilestone);

export default router;
