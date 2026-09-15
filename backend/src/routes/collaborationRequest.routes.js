import { Router } from 'express';

import { respondToRequest } from '../controllers/project.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/collaboration-requests/:requestId/respond
router.post('/:requestId/respond', requireAuth, respondToRequest);

export default router;
