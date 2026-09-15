import { Router } from 'express';

import {
  create,
  list,
  getById,
  update,
  matchedProjects,
} from '../controllers/industry.controller.js';
import { requireAuth, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

router
  .route('/')
  .get(list)
  .post(requireAuth, authorizeRoles('industry', 'admin'), create);

router.get('/:id/matched-projects', requireAuth, matchedProjects);

router.route('/:id').get(getById).patch(requireAuth, update);

export default router;
