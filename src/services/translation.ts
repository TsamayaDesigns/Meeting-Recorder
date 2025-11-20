export interface TranslationResult {
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

export class TranslationService {
  private cache: Map<string, TranslationResult> = new Map();

  async translate(text: string, targetLang: string = 'en-GB'): Promise<TranslationResult> {
    const cacheKey = `${text}_${targetLang}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const detectedLanguage = await this.detectLanguage(text);

      if (detectedLanguage === 'en' || detectedLanguage === 'en-GB') {
        const result = {
          translatedText: text,
          detectedLanguage,
          confidence: 1.0,
        };
        this.cache.set(cacheKey, result);
        return result;
      }

      const translatedText = await this.translateText(text, detectedLanguage, targetLang);

      const result = {
        translatedText,
        detectedLanguage,
        confidence: 0.85,
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Translation error:', error);
      return {
        translatedText: text,
        detectedLanguage: 'unknown',
        confidence: 0,
      };
    }
  }

  private async detectLanguage(text: string): Promise<string> {
    const afrikaansPatterns = [
      /\b(is|die|en|van|vir|met|nie|het|aan|by)\b/i,
      /\b(ek|jy|hy|sy|ons|julle|hulle)\b/i,
    ];

    const afrikaansMatches = afrikaansPatterns.reduce((count, pattern) => {
      return count + (text.match(pattern) || []).length;
    }, 0);

    if (afrikaansMatches > 2) {
      return 'af';
    }

    return 'en';
  }

  private async translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data && data[0] && data[0][0] && data[0][0][0]) {
        return data[0][0][0];
      }

      return text;
    } catch (error) {
      console.error('Translation API error:', error);
      return text;
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

export const translationService = new TranslationService();
