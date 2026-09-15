import { Router } from 'express';

import {
  create,
  list,
  nearby,
  getById,
  update,
  remove,
  postComment,
  getComments,
  join,
  leave,
  report,
} from '../controllers/discussion.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { optionalAuth } from '../middleware/optionalAuth.middleware.js';

const router = Router();

router
  .route('/')
  .get(list)
  .post(requireAuth, create);

router.get('/nearby', nearby);

router
  .route('/:id')
  .get(optionalAuth, getById)
  .patch(requireAuth, update)
  .delete(requireAuth, remove);

router.get('/:id/comments', getComments);
router.post('/:id/comments', requireAuth, postComment);
router.post('/:id/join', requireAuth, join);
router.delete('/:id/join', requireAuth, leave);
router.post('/:id/report', requireAuth, report);

export default router;
