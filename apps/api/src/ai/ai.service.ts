import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

export interface AiEnhanceInput {
  name: string;
  description?: string | null;
  tags?: string[];
  publisher?: string | null;
  designer?: string | null;
  category?: string;
  yearPublished?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playTimeMinutes?: number | null;
  language?: string | null;
  sellerSku?: string | null;
  allSellerSkus?: string[];
}

export interface AiEnhanceResult {
  name: string;
  description: string;
  slug: string;
  tags: string[];
  skuIssue: string | null;
  reasoning: string;
}

@Injectable()
export class AiService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey.trim() === '') throw new Error('OPENAI_API_KEY not configured');
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async enhanceProduct(input: AiEnhanceInput): Promise<AiEnhanceResult> {
    const client = this.getClient();

    const skuContext = input.allSellerSkus?.length
      ? `\nOther SKUs from this seller: ${input.allSellerSkus.filter((s) => s !== input.sellerSku).slice(0, 20).join(', ')}`
      : '';

    const prompt = `You are an expert at writing SEO-optimized product listings for a board game marketplace.

Given this product data, return improved content that will rank well in search engines and convert buyers.

Product data:
- Name: ${input.name}
- Description: ${input.description || '(none)'}
- Publisher: ${input.publisher || '(unknown)'}
- Designer: ${input.designer || '(unknown)'}
- Category: ${input.category || 'board-game'}
- Year: ${input.yearPublished || '(unknown)'}
- Players: ${input.minPlayers ?? '?'}–${input.maxPlayers ?? '?'}
- Play time: ${input.playTimeMinutes ? `${input.playTimeMinutes} min` : '(unknown)'}
- Language: ${input.language || '(unknown)'}
- Current tags: ${input.tags?.join(', ') || '(none)'}
- Seller SKU: ${input.sellerSku || '(none)'}${skuContext}

Return ONLY valid JSON with this exact shape:
{
  "name": "...",
  "description": "...",
  "slug": "...",
  "tags": ["...", "..."],
  "skuIssue": "..." or null,
  "reasoning": "..."
}

Rules:
- name: Keep the real product name, add key attributes (edition, language, player count) if missing. Max 80 chars.
- description: 2–3 sentences. Start with what it is, mention key selling points (players, time, complexity), end with a hook. No markdown.
- slug: kebab-case, 3–6 words, no version numbers. Only lowercase a-z and hyphens.
- tags: 5–10 relevant tags. Include: game mechanic (e.g. "deck-building"), player count ("2-players"), duration ("under-60-min"), age range, publisher name, genre. All lowercase kebab-case.
- skuIssue: If the seller SKU looks inconsistent with others (different format, missing prefix, duplicated pattern), explain briefly in one sentence. Otherwise null.
- reasoning: One sentence explaining the main SEO change you made.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 600,
    });

    const raw = response.choices[0].message.content ?? '{}';
    const parsed = JSON.parse(raw) as AiEnhanceResult;

    return {
      name: parsed.name ?? input.name,
      description: parsed.description ?? input.description ?? '',
      slug: parsed.slug ?? '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      skuIssue: parsed.skuIssue ?? null,
      reasoning: parsed.reasoning ?? '',
    };
  }
}
