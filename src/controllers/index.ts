import * as express from 'express';

import api from './api/index';
import auth from './auth/index';

const router = express.Router();

router.use('/api', api);
router.use('/auth', auth);

export default router;
