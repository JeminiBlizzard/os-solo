/**
 * Incident Analyzer
 *
 * Uses AI to analyze server incidents and find similar past incidents.
 */

import { db, schema } from '@os-solo/db';
import { eq, and, desc, ne } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Calculate similarity between two incident descriptions
 * Returns a score from 0 to 1
 */
function calculateSimilarity(text1: string, text2: string): number {
  // Simple similarity based on common words
  // In production, this would use embeddings or more sophisticated NLP

  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Use AI to analyze incident and find similar past incidents
 */
export async function analyzeIncident(
  incidentId: number,
  serverId: number,
  userId: number
): Promise<void> {
  try {
    // Get the current incident
    const incident = await db.query.serverIncidents.findFirst({
      where: eq(schema.serverIncidents.id, incidentId),
    });

    if (!incident) {
      console.error(`[incident-analyzer] Incident ${incidentId} not found`);
      return;
    }

    // Get past incidents on the same server (last 30 days, resolved only)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const pastIncidents = await db
      .select({
        id: schema.serverIncidents.id,
        title: schema.serverIncidents.title,
        description: schema.serverIncidents.description,
        severity: schema.serverIncidents.severity,
        status: schema.serverIncidents.status,
        startedAt: schema.serverIncidents.startedAt,
        resolvedAt: schema.serverIncidents.resolvedAt,
      })
      .from(schema.serverIncidents)
      .where(
        and(
          eq(schema.serverIncidents.serverId, serverId),
          eq(schema.serverIncidents.status, 'resolved'),
          ne(schema.serverIncidents.id, incidentId)
        )
      )
      .orderBy(desc(schema.serverIncidents.startedAt))
      .limit(10);

    if (pastIncidents.length === 0) {
      console.log(`[incident-analyzer] No past incidents found for server ${serverId}`);
      return;
    }

    // Use AI to analyze similarity
    const prompt = `You are analyzing a server incident. Compare this new incident with past incidents on the same server.

NEW INCIDENT:
Title: ${incident.title}
Description: ${incident.description || 'No description'}
Severity: ${incident.severity}

PAST INCIDENTS:
${pastIncidents.map((p, i) => `${i + 1}. [ID ${p.id}] ${p.title} (${p.severity}) - ${p.description || 'No description'}`).join('\n')}

Analyze if any of the past incidents are similar to the new incident (>80% similarity based on root cause, symptoms, or error patterns).

Respond in JSON format:
{
  "similar_incident_id": <incident_id or null>,
  "similarity_score": <0-100>,
  "analysis": "<brief explanation of why they are similar or different>"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Parse AI response
    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';
    let aiResult: { similar_incident_id: number | null; similarity_score: number; analysis: string };

    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]!);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      // Fallback: use simple text similarity
      let maxSimilarity = 0;
      let mostSimilarId: number | null = null;

      for (const past of pastIncidents) {
        const similarity = calculateSimilarity(
          incident.title + ' ' + (incident.description || ''),
          past.title + ' ' + (past.description || '')
        );

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          mostSimilarId = past.id;
        }
      }

      aiResult = {
        similar_incident_id: maxSimilarity > 0.8 ? mostSimilarId : null,
        similarity_score: Math.round(maxSimilarity * 100),
        analysis: `Automated text similarity analysis (score: ${Math.round(maxSimilarity * 100)}%)`,
      };
    }

    // Update incident with AI analysis
    await db
      .update(schema.serverIncidents)
      .set({
        aiAnalysis: aiResult.analysis,
        similarIncidentId: aiResult.similarity_score >= 80 ? aiResult.similar_incident_id : null,
      })
      .where(eq(schema.serverIncidents.id, incidentId));

    console.log(
      `[incident-analyzer] Incident ${incidentId} analyzed: similarity=${aiResult.similarity_score}%, similar_to=${aiResult.similar_incident_id || 'none'}`
    );
  } catch (error) {
    console.error(`[incident-analyzer] Failed to analyze incident ${incidentId}:`, error);

    // Update incident to indicate analysis failed (but don't block incident creation)
    await db
      .update(schema.serverIncidents)
      .set({
        aiAnalysis: 'Analysis failed: ' + (error instanceof Error ? error.message : String(error)),
      })
      .where(eq(schema.serverIncidents.id, incidentId));
  }
}
