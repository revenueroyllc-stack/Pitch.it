export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'Deepgram not configured',
      fallback: 'webspeech',
      message: 'DEEPGRAM_API_KEY is not set. The app will use the browser Web Speech API instead.',
    });
  }

  try {
    // Fetch the first project to get a project ID
    const projectsRes = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${apiKey}` },
    });

    if (!projectsRes.ok) {
      const txt = await projectsRes.text();
      throw new Error(`Deepgram projects API error ${projectsRes.status}: ${txt}`);
    }

    const { projects } = await projectsRes.json();
    if (!projects || projects.length === 0) {
      throw new Error('No Deepgram projects found for this API key');
    }

    const projectId = projects[0].project_id;

    // Create a short-lived temporary key (10 minutes)
    const keyRes = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: `saynow-temp-${Date.now()}`,
        scopes: ['usage:write'],
        time_to_live_in_seconds: 600,
      }),
    });

    if (!keyRes.ok) {
      const txt = await keyRes.text();
      throw new Error(`Deepgram key creation failed ${keyRes.status}: ${txt}`);
    }

    const { key } = await keyRes.json();
    return res.status(200).json({ key });
  } catch (err) {
    console.error('deepgram-token error:', err.message);
    return res.status(500).json({ error: err.message, fallback: 'webspeech' });
  }
}
