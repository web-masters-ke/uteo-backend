import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY;
    const isRealKey = !!key && key.length > 20 && !key.includes('...');
    this.client = isRealKey ? new Anthropic({ apiKey: key! }) : null;
    if (!this.client) this.logger.warn('ANTHROPIC_API_KEY not configured — AI features will return stubs. Set a real key from console.anthropic.com');
  }

  private async ask(prompt: string, system: string, maxTokens = 600): Promise<string> {
    if (!this.client) return '';
    try {
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = msg.content[0];
      return block.type === 'text' ? block.text.trim() : '';
    } catch (err) {
      this.logger.error('Claude API error', err);
      return '';
    }
  }

  async generateInterviewQuestions(
    jobTitle: string,
    skills: string[],
    candidateName?: string,
    notes?: string,
  ): Promise<string[]> {
    const stub = [
      `Tell me about your experience with ${skills[0] ?? jobTitle}.`,
      'Describe a challenging project you led from start to finish.',
      'How do you handle tight deadlines and shifting priorities?',
      'What does your ideal team environment look like?',
      'Where do you see yourself professionally in two years?',
    ];

    const prompt = `Job: ${jobTitle}
Required skills: ${skills.join(', ') || 'general'}
${candidateName ? `Candidate: ${candidateName}` : ''}
${notes ? `Recruiter notes: ${notes}` : ''}

Generate 6 sharp interview questions. Mix technical depth and behavioural/culture-fit.
Return ONLY a JSON array of strings, no extra text. Example: ["Q1","Q2",...]`;

    const raw = await this.ask(prompt, 'You are a senior talent acquisition specialist. Output only valid JSON.', 800);
    if (!raw) return stub;
    try {
      const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/,''));
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch { /* fall through */ }
    // Try to extract array from partial response
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return stub;
  }

  async generateCandidateInsight(
    candidateName: string,
    headline: string | null,
    skills: string[],
    matchedSkills: string[],
    jobTitle: string,
  ): Promise<string> {
    const stub = matchedSkills.length > 0
      ? `Matches ${matchedSkills.length} of the required skills including ${matchedSkills.slice(0, 2).join(' and ')}.`
      : 'Open to work. Review their profile for fit.';

    const prompt = `Candidate: ${candidateName}
Headline: ${headline ?? 'not set'}
All skills: ${skills.join(', ') || 'none listed'}
Skills matching "${jobTitle}": ${matchedSkills.join(', ') || 'none'}

Write a 1-sentence recruiter insight (max 20 words) about this candidate's fit. Be direct and specific.`;

    const text = await this.ask(prompt, 'You are a concise recruiting assistant. One sentence only, no quotes.', 80);
    return text || stub;
  }

  async careerAdvice(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const stub = `Great question about "${lastUserMsg.slice(0, 60)}${lastUserMsg.length > 60 ? '…' : ''}". To get live AI career advice powered by Claude, the platform admin needs to configure an Anthropic API key at console.anthropic.com.`;

    if (!this.client) return stub;
    try {
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: `You are Uteo's AI career advisor. Help job seekers with CV tips, interview prep, salary negotiation, and career decisions. Be warm, practical, and concise. Keep replies under 120 words. Never use markdown — no asterisks, no hyphens for bullets, no headers. Write in plain conversational prose only.`,
        messages,
      });
      const block = msg.content[0];
      return block.type === 'text' ? block.text.trim() : stub;
    } catch (err) {
      this.logger.error('Claude career advice error', err);
      return stub;
    }
  }

  async enhanceJobDescription(title: string, description: string): Promise<{ description: string; tags: string[] }> {
    const stub = { description, tags: [] as string[] };

    const prompt = `Job title: ${title}
Current description:
${description}

1. Rewrite the description to be compelling, inclusive, and specific (max 200 words).
2. Extract up to 5 skill/keyword tags.
Return JSON: { "description": "...", "tags": ["tag1",...] }`;

    const raw = await this.ask(prompt, 'You are a recruiting copywriter. Output only valid JSON.', 600);
    if (!raw) return stub;
    try {
      const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/, ''));
      if (parsed.description) return parsed;
    } catch { /* fall through */ }
    return stub;
  }
}
