import { Router } from 'express';

import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import challengeRoutes from './challenge.routes.js';
import projectRoutes from './project.routes.js';
import milestoneRoutes from './milestone.routes.js';
import discussionRoutes from './discussion.routes.js';
import universityRoutes from './university.routes.js';
import industryRoutes from './industry.routes.js';
import collaborationRequestRoutes from './collaborationRequest.routes.js';
import adminRoutes from './admin.routes.js';
import solutionRoutes from './solution.routes.js';
import voiceRoutes from './voice.routes.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/challenges', challengeRoutes);
router.use('/voice', voiceRoutes);
router.use('/projects', projectRoutes);
router.use('/milestones', milestoneRoutes);
router.use('/discussions', discussionRoutes);
router.use('/solutions', solutionRoutes);
router.use('/universities', universityRoutes);
router.use('/industries', industryRoutes);
router.use('/collaboration-requests', collaborationRequestRoutes);
router.use('/admin', adminRoutes);

export default router;
