import { supabase } from '../lib/supabase';

const ZOOM_CLIENT_ID = import.meta.env.VITE_ZOOM_CLIENT_ID || '';
const ZOOM_CLIENT_SECRET = import.meta.env.VITE_ZOOM_CLIENT_SECRET || '';
const ZOOM_REDIRECT_URI = `${window.location.origin}/auth/zoom/callback`;

export interface ZoomMeeting {
  id: string;
  uuid: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  join_url: string;
  created_at: string;
}

export class ZoomIntegrationService {
  async initiateOAuth() {
    const authUrl = new URL('https://zoom.us/oauth/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', ZOOM_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', ZOOM_REDIRECT_URI);
    authUrl.searchParams.append('state', this.generateState());

    window.location.href = authUrl.toString();
  }

  async handleAuthCallback(code: string, state: string): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/zoom/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange auth code');
      }

      return true;
    } catch (error) {
      console.error('Zoom OAuth callback error:', error);
      return false;
    }
  }

  async getUpcomingMeetings(): Promise<ZoomMeeting[]> {
    try {
      const { data: integration, error: intError } = await supabase
        .from('oauth_integrations')
        .select('*')
        .eq('provider', 'zoom')
        .maybeSingle();

      if (intError || !integration) {
        return [];
      }

      const response = await fetch(
        'https://api.zoom.us/v2/users/me/meetings?type=upcoming',
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
        throw new Error('Failed to fetch Zoom meetings');
      }

      const data = await response.json();
      return data.meetings || [];
    } catch (error) {
      console.error('Error fetching Zoom meetings:', error);
      return [];
    }
  }

  async startMeetingRecording(meetingId: string): Promise<boolean> {
    try {
      const { data: integration, error: intError } = await supabase
        .from('oauth_integrations')
        .select('*')
        .eq('provider', 'zoom')
        .maybeSingle();

      if (intError || !integration) {
        throw new Error('Zoom integration not found');
      }

      const response = await fetch(
        `https://api.zoom.us/v2/meetings/${meetingId}/recordings/start`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'start',
          }),
        }
      );

      return response.ok || response.status === 204;
    } catch (error) {
      console.error('Error starting Zoom recording:', error);
      return false;
    }
  }

  async getMeetingRecordings(meetingId: string): Promise<any[]> {
    try {
      const { data: integration, error: intError } = await supabase
        .from('oauth_integrations')
        .select('*')
        .eq('provider', 'zoom')
        .maybeSingle();

      if (intError || !integration) {
        return [];
      }

      const response = await fetch(
        `https://api.zoom.us/v2/meetings/${meetingId}/recordings`,
        {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          await this.refreshAccessToken(integration.id);
          return this.getMeetingRecordings(meetingId);
        }
        return [];
      }

      const data = await response.json();
      return data.recording_files || [];
    } catch (error) {
      console.error('Error fetching Zoom recordings:', error);
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

      const authHeader = `Basic ${btoa(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`)}`;

      const response = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token || '',
        }).toString(),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh Zoom token');
      }

      const tokenData = await response.json();

      await supabase
        .from('oauth_integrations')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || integration.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', integrationId);
    } catch (error) {
      console.error('Error refreshing Zoom token:', error);
      throw error;
    }
  }

  private generateState(): string {
    return Math.random().toString(36).substring(7);
  }

  async disconnectZoom(): Promise<void> {
    const { error } = await supabase
      .from('oauth_integrations')
      .delete()
      .eq('provider', 'zoom');

    if (error) {
      throw error;
    }
  }
}

export const zoomIntegrationService = new ZoomIntegrationService();
