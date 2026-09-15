import { Router } from 'express';

import { list, getById } from '../controllers/solution.controller.js';

const router = Router();

// public solution library — only deployed/completed projects appear here
router.get('/', list);
router.get('/:id', getById);

export default router;
