import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { withRetry } from '../utils/retry.js';
import type { AIAnalysisResult, IndividualScores, PoliticalTopic } from '../types/index.js';
import { POLITICAL_TOPICS } from '../types/index.js';
import type { AssetType } from '@prisma/client';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-6';

// ─────────────────────────────────────────────────────────────────────────────
// Core: analyze a single mention for political sentiment, topics, entities
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeMention(
  content: string,
  clientName: string,
  clientKeywords: string[],
): Promise<AIAnalysisResult> {
  const prompt = `You are a political intelligence analyst specializing in Indian politics, South Asian political discourse, Hindi/Hinglish/regional language content, and ORM (Online Reputation Management).

Analyze the following social media / news content about ${clientName}.

CLIENT KEYWORDS: ${clientKeywords.join(', ')}

CONTENT TO ANALYZE:
"""
${content}
"""

Respond ONLY with a valid JSON object matching this exact schema:
{
  "politicalSentiment": "STRONGLY_POSITIVE" | "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "STRONGLY_NEGATIVE" | "MIXED",
  "contentTone": "SUPPORTIVE" | "CRITICAL" | "INFLAMMATORY" | "SATIRICAL" | "FACTUAL" | "MISINFORMATION" | "THREATENING" | "NEUTRAL",
  "sentimentScore": <number -1.0 to 1.0>,
  "topics": [<array of topics from: ${POLITICAL_TOPICS.join(', ')}>],
  "namedEntities": {
    "politicians": [<string names>],
    "parties": [<string party names>],
    "places": [<string place names>],
    "organizations": [<string org names>]
  },
  "isDisinformation": <boolean>,
  "threatLevel": <integer 0-10>,
  "summaryEn": "<concise 2-sentence English summary of political significance>",
  "summaryHi": "<same summary in Hindi — use Devanagari script>",
  "detectedLanguage": "<ISO 639-1 code or 'hi' / 'hinglish' / 'en'>"
}

Scoring guide for threatLevel:
0-2: neutral/positive content
3-4: mildly critical
5-6: significantly negative, could damage reputation
7-8: high-threat: viral attacks, coordinated criticism, serious allegations
9-10: crisis-level: criminal allegations, incitement, imminent reputational damage

IMPORTANT: Return ONLY the JSON. No preamble, no explanation.`;

  return withRetry(
    async () => {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      const parsed = JSON.parse(text) as AIAnalysisResult;

      // Validate topics against known taxonomy
      parsed.topics = parsed.topics.filter((t): t is PoliticalTopic =>
        (POLITICAL_TOPICS as readonly string[]).includes(t),
      );

      return parsed;
    },
    { context: 'analyzeMention', maxAttempts: 3, baseDelayMs: 2000 },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Score an individual's influence, risk, and stance toward a client
// ─────────────────────────────────────────────────────────────────────────────
export async function scoreIndividual(
  individualName: string,
  individualType: string,
  recentMentions: string[],
  clientName: string,
  followerCount: number,
): Promise<IndividualScores> {
  const mentionSample = recentMentions.slice(0, 5).join('\n---\n');

  const prompt = `You are a political intelligence analyst. Score this individual's relationship to ${clientName}.

INDIVIDUAL: ${individualName} (${individualType})
FOLLOWERS: ${followerCount.toLocaleString()}

RECENT CONTENT SAMPLE:
"""
${mentionSample}
"""

Return ONLY a JSON object:
{
  "influenceScore": <0-100, weighted by follower reach, engagement, media amplification>,
  "riskScore": <0-100, how much threat this person poses to ${clientName}'s reputation>,
  "stanceScore": <-1.0 hostile to 1.0 ally>,
  "stance": "ALLY" | "THREAT" | "WATCHLIST" | "NEUTRAL",
  "reasoning": "<1-sentence explanation of stance classification>"
}

Influence scoring:
- 0-20: micro influencer, low reach
- 21-50: mid-tier, some amplification
- 51-75: significant reach, media presence
- 76-100: major political figure, viral reach

Risk scoring considers: hostility, reach, credibility, coordination potential.`;

  return withRetry(
    async () => {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      return JSON.parse(text) as IndividualScores;
    },
    { context: 'scoreIndividual', maxAttempts: 3 },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate a response asset of the requested type
// ─────────────────────────────────────────────────────────────────────────────
export async function generateResponseAsset(
  assetType: AssetType,
  clientName: string,
  context: string,
  triggeringContent: string,
): Promise<{ contentEn: string; contentHi: string; title: string }> {
  const assetGuidance: Record<AssetType, string> = {
    COUNTER_BRIEF: 'A structured intelligence brief (200-300 words) with: Situation, Key Claims, Our Response, Recommended Actions',
    RAPID_RESPONSE_TWEET: 'A concise tweet (max 280 chars) that firmly but diplomatically addresses the narrative. Optionally include hashtags.',
    PRESS_STATEMENT: 'A formal press statement (300-400 words) suitable for distribution to media houses',
    PRESS_KIT: 'A comprehensive press kit with background facts, key achievements, quotes, and contact details',
    WHATSAPP_FORWARD: 'A persuasive WhatsApp forward message (150-200 words) in conversational language, suitable for grassroots sharing. Include emojis sparingly.',
    SOCIAL_CAPTION: 'An engaging social media caption (100-150 words) with a positive narrative frame',
    TALKING_POINTS: 'Bullet-point talking points (5-7 points) for spokesperson use in media interviews',
    FACT_CHECK: 'A structured fact-check document refuting false claims with evidence-based counters',
    NARRATIVE_MEMO: 'An internal strategy memo reframing the narrative for the campaign team',
    MEDIA_PITCH: 'A compelling media pitch email to journalists offering an exclusive angle',
    CRISIS_STATEMENT: 'An empathetic crisis communication statement that acknowledges concerns while protecting reputation',
  };

  const guidance = assetGuidance[assetType] ?? 'A professional communication asset';

  const prompt = `You are a senior political communication strategist for ${clientName} in India.

TRIGGERING SITUATION:
"""
${triggeringContent}
"""

CONTEXT: ${context}

Generate a ${assetType.replace(/_/g, ' ')} response asset.
Format: ${guidance}

Requirements:
- Politically nuanced for Indian democratic context
- Factual — never fabricate claims or statistics
- Professional yet relatable tone
- Bilingual output required

Return ONLY a JSON object:
{
  "title": "<descriptive title for this asset>",
  "contentEn": "<English content>",
  "contentHi": "<Hindi content in Devanagari script — faithful translation, not word-for-word>"
}`;

  return withRetry(
    async () => {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      return JSON.parse(text) as { contentEn: string; contentHi: string; title: string };
    },
    { context: `generateResponseAsset:${assetType}`, maxAttempts: 3 },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate an alert brief from a cluster of related mentions
// ─────────────────────────────────────────────────────────────────────────────
export async function generateAlertBrief(
  clientName: string,
  alertType: string,
  mentionSummaries: string[],
): Promise<{ brief: string; recommendedActions: string[] }> {
  const prompt = `You are a political intelligence officer. Generate a command-grade alert brief.

CLIENT: ${clientName}
ALERT TYPE: ${alertType}

INCOMING SIGNAL (${mentionSummaries.length} mentions):
${mentionSummaries.slice(0, 10).map((m, i) => `${i + 1}. ${m}`).join('\n')}

Return ONLY JSON:
{
  "brief": "<3-4 sentence intelligence brief explaining the threat/opportunity, its scope, and likely trajectory>",
  "recommendedActions": ["<action 1>", "<action 2>", "<action 3>"]
}

Be concise, accurate, and actionable. No speculation beyond evidence.`;

  return withRetry(
    async () => {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 768,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      return JSON.parse(text) as { brief: string; recommendedActions: string[] };
    },
    { context: 'generateAlertBrief', maxAttempts: 3 },
  );
}

logger.info('Claude AI service initialized', { model: MODEL });
