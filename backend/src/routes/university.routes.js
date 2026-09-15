import { Router } from 'express';

import {
  create,
  list,
  getById,
  update,
  assignedChallenges,
} from '../controllers/university.controller.js';
import { requireAuth, authorizeRoles } from '../middleware/auth.middleware.js';
import { optionalAuth } from '../middleware/optionalAuth.middleware.js';

const router = Router();

router
  .route('/')
  .get(list)
  .post(requireAuth, authorizeRoles('university', 'admin'), create);

router.get('/:id/challenges', requireAuth, assignedChallenges);

router.route('/:id').get(optionalAuth, getById).patch(requireAuth, update);

export default router;
