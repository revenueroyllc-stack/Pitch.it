function normalizeCard(card, fallbackTimestamp) {
  return {
    type: card?.type || 'Tip',
    tone: card?.tone || 'tip',
    trigger: card?.trigger || 'coach suggestion',
    text: card?.text || card?.message || '',
    quote: card?.quote || '',
    timestamp: card?.timestamp || fallbackTimestamp
  };
}

export function buildHeuristicCoachCards({ latestUtterance = '', objections = [], talkingPoints = [], elapsedSeconds = 0, timestamp = '00:00' }) {
  const text = latestUtterance.toLowerCase();
  const cards = [];

  if (!text) return cards;

  if (/(price|pricing|budget|cost|expensive)/.test(text)) {
    cards.push(normalizeCard({
      type: 'Tip',
      tone: 'tip',
      trigger: 'pricing concern detected',
      text: 'Anchor on ROI and time savings before discussing price.'
    }, timestamp));
  }

  if (/(vendor|contract|incumbent|already use|current provider)/.test(text)) {
    const competitionAnswer = objections.find(item => /vendor|competition|provider/i.test(`${item.category || ''} ${item.question}`));
    cards.push(normalizeCard({
      type: 'Response',
      tone: 'response',
      trigger: 'incumbent solution detected',
      text: competitionAnswer?.answer || 'Ask what they would improve in the current setup to create a switch conversation.',
      quote: competitionAnswer?.question || ''
    }, timestamp));
  }

  if (/(later|next quarter|timing|not now|follow up|circle back)/.test(text)) {
    cards.push(normalizeCard({
      type: 'Question',
      tone: 'question',
      trigger: 'timing hesitation detected',
      text: 'Clarify the decision timeline: ask what has to happen internally before they can move.',
      quote: 'What would need to change for this to become a priority?'
    }, timestamp));
  }

  if (elapsedSeconds > 45 && !text.includes('?')) {
    cards.push(normalizeCard({
      type: 'Tip',
      tone: 'tip',
      trigger: 'discovery opportunity',
      text: 'Pause and ask an open question to rebalance the conversation.'
    }, timestamp));
  }

  if (cards.length === 0 && talkingPoints.length > 0) {
    cards.push(normalizeCard({
      type: 'Tip',
      tone: 'tip',
      trigger: 'next best action',
      text: `Bring the conversation back to: ${talkingPoints[0]}`
    }, timestamp));
  }

  return cards.slice(0, 3);
}

export async function requestCoachSuggestions({ endpoint, bearerToken, payload, signal, fallbackTimestamp = '00:00' }) {
  if (!endpoint) return [];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {})
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    throw new Error(`Coach endpoint returned ${response.status}`);
  }

  const data = await response.json();
  const rawCards = Array.isArray(data?.cards)
    ? data.cards
    : Array.isArray(data?.suggestions)
      ? data.suggestions.map(item => typeof item === 'string' ? { text: item } : item)
      : [];

  return rawCards
    .map(item => normalizeCard(item, fallbackTimestamp))
    .filter(item => item.text);
}
