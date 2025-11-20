import { Transcription } from '../lib/supabase';

export interface MeetingSummaryData {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
}

export class SummarizationService {
  async generateSummary(transcriptions: Transcription[]): Promise<MeetingSummaryData> {
    if (transcriptions.length === 0) {
      return {
        summary: 'No transcriptions available for this meeting.',
        keyPoints: [],
        actionItems: [],
      };
    }

    const fullText = transcriptions
      .map(t => t.translated_text || t.original_text)
      .join(' ');

    const summary = this.extractiveSummary(fullText);
    const keyPoints = this.extractKeyPoints(transcriptions);
    const actionItems = this.extractActionItems(fullText);

    return {
      summary,
      keyPoints,
      actionItems,
    };
  }

  private extractiveSummary(text: string, maxSentences: number = 3): string {
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    if (sentences.length === 0) {
      return 'Meeting recording in progress.';
    }

    const sentenceScores = sentences.map(sentence => {
      const words = sentence.toLowerCase().split(/\s+/);
      const importantWords = words.filter(word =>
        word.length > 4 &&
        !this.isStopWord(word)
      );

      return {
        sentence,
        score: importantWords.length / words.length,
      };
    });

    sentenceScores.sort((a, b) => b.score - a.score);

    return sentenceScores
      .slice(0, Math.min(maxSentences, sentenceScores.length))
      .map(s => s.sentence)
      .join('. ') + '.';
  }

  private extractKeyPoints(transcriptions: Transcription[]): string[] {
    const segments = this.segmentByTopic(transcriptions);
    const keyPoints: string[] = [];

    for (const segment of segments.slice(0, 5)) {
      const text = segment.map(t => t.translated_text || t.original_text).join(' ');
      const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);

      if (sentences.length > 0) {
        keyPoints.push(sentences[0]);
      }
    }

    return keyPoints;
  }

  private segmentByTopic(transcriptions: Transcription[]): Transcription[][] {
    const segments: Transcription[][] = [];
    let currentSegment: Transcription[] = [];
    let lastTimestamp = 0;

    for (const trans of transcriptions) {
      if (trans.timestamp_start - lastTimestamp > 10000 && currentSegment.length > 0) {
        segments.push([...currentSegment]);
        currentSegment = [];
      }

      currentSegment.push(trans);
      lastTimestamp = trans.timestamp_end;
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    return segments;
  }

  private extractActionItems(text: string): string[] {
    const actionPatterns = [
      /(?:need to|must|should|will|have to|going to)\s+([^.!?]+)/gi,
      /(?:action item|task|todo|follow up):\s*([^.!?]+)/gi,
      /(?:assign|assigned to|responsible for)\s+([^.!?]+)/gi,
    ];

    const actionItems = new Set<string>();

    for (const pattern of actionPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const item = match[0].trim();
        if (item.length > 10 && item.length < 200) {
          actionItems.add(item);
        }
      }
    }

    return Array.from(actionItems).slice(0, 5);
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
      'in', 'with', 'to', 'for', 'of', 'as', 'by', 'that', 'this',
      'it', 'from', 'be', 'are', 'was', 'were', 'been', 'have', 'has',
      'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    ]);

    return stopWords.has(word.toLowerCase());
  }
}

export const summarizationService = new SummarizationService();
