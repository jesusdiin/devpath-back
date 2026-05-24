import { Router } from 'express';
import {
  fetchCallStatus,
  getRecordings,
  getStreamTwiml,
  handleInbound,
  handleStatusCallback,
  initiateOutbound,
} from '../controllers/calls.controller';
import { validateTwilioSignature } from '../middleware/twilioSignature';

const router = Router();

router.post('/outbound', initiateOutbound);
router.post('/inbound', validateTwilioSignature, handleInbound);
router.post('/status', validateTwilioSignature, handleStatusCallback);
router.get('/twiml/stream', getStreamTwiml);
router.post('/twiml/stream', getStreamTwiml);
router.get('/:callSid/recordings', getRecordings);
router.get('/:callSid', fetchCallStatus);

export default router;
