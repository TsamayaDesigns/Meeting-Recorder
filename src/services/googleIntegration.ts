import { supabase } from '../lib/supabase';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = `${window.location.origin}/auth/google/callback`;

export interface GoogleMeetEvent {
  id: string;
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
}

export class GoogleIntegrationService {
  async initiateOAuth() {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
      'openid',
      'email',
      'profile',
    ];

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', GOOGLE_REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes.join(' '));
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    authUrl.searchParams.append('state', this.generateState());

    window.location.href = authUrl.toString();
  }

  async handleAuthCallback(code: string, state: string): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/google/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange auth code');
      }

      return true;
    } catch (error) {
      console.error('OAuth callback error:', error);
      return false;
    }
  }

  async getUpcomingMeetings(): Promise<GoogleMeetEvent[]> {
    try {
      const { data: integration, error: intError } = await supabase
        .from('oauth_integrations')
        .select('*')
        .eq('provider', 'google')
        .maybeSingle();

      if (intError || !integration) {
        return [];
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?orderBy=startTime&singleEvents=true&timeMin=${new Date().toISOString()}&maxResults=20&conferenceDataVersion=1`,
        {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          await this.refreshAccessToken(integration.id);
          return this.getUpcomingMeetings();
        }
        throw new Error('Failed to fetch calendar events');
      }

      const data = await response.json();
      return (data.items || [])
        .filter((event: any) => event.conferenceData?.entryPoints)
        .map((event: any) => ({
          id: event.id,
          summary: event.summary,
          description: event.description,
          startTime: event.start.dateTime || event.start.date,
          endTime: event.end.dateTime || event.end.date,
          conferenceData: event.conferenceData,
        }));
    } catch (error) {
      console.error('Error fetching Google Meet events:', error);
      return [];
    }
  }

  private async refreshAccessToken(integrationId: string): Promise<void> {
    try {
      const { data: integration, error } = await supabase
        .from('oauth_integrations')
        .select('*')
        .eq('id', integrationId)
        .single();

      if (error || !integration) {
        throw new Error('Integration not found');
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: integration.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const tokenData = await response.json();

      await supabase
        .from('oauth_integrations')
        .update({
          access_token: tokenData.access_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', integrationId);
    } catch (error) {
      console.error('Error refreshing Google token:', error);
      throw error;
    }
  }

  private generateState(): string {
    return Math.random().toString(36).substring(7);
  }

  async disconnectGoogle(): Promise<void> {
    const { error } = await supabase
      .from('oauth_integrations')
      .delete()
      .eq('provider', 'google');

    if (error) {
      throw error;
    }
  }
}

export const googleIntegrationService = new GoogleIntegrationService();
