import twilio from 'twilio';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    TWILIO_TWIML_APP_SID,
  } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET) {
    return res.status(503).json({
      error: 'Twilio not configured',
      message: 'TWILIO_ACCOUNT_SID, TWILIO_API_KEY, and TWILIO_API_SECRET must be set to enable calling.',
    });
  }

  const { userId, identity } = req.body || {};
  const tokenIdentity = identity || userId || `user_${Date.now()}`;

  try {
    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { identity: tokenIdentity, ttl: 3600 }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_TWIML_APP_SID || undefined,
      incomingAllow: false,
    });

    token.addGrant(voiceGrant);

    return res.status(200).json({ token: token.toJwt(), identity: tokenIdentity });
  } catch (err) {
    console.error('twilio-token error:', err.message);
    return res.status(500).json({ error: `Twilio token error: ${err.message}` });
  }
}
