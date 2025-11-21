import { useState, useEffect } from 'react';
import { Calendar, Video, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { googleIntegrationService } from '../services/googleIntegration';
import { zoomIntegrationService } from '../services/zoomIntegration';

interface OAuthIntegration {
  id: string;
  provider: string;
  email: string;
  created_at: string;
}

export const IntegrationSetup = () => {
  const [integrations, setIntegrations] = useState<OAuthIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const { data, error: err } = await supabase
        .from('oauth_integrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setIntegrations(data || []);
    } catch (err) {
      console.error('Error loading integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleConnect = async () => {
    setConnecting('google');
    setError(null);

    try {
      googleIntegrationService.initiateOAuth();
    } catch (err) {
      setError('Failed to connect Google. Please try again.');
      setConnecting(null);
    }
  };

  const handleZoomConnect = async () => {
    setConnecting('zoom');
    setError(null);

    try {
      zoomIntegrationService.initiateOAuth();
    } catch (err) {
      setError('Failed to connect Zoom. Please try again.');
      setConnecting(null);
    }
  };

  const handleDisconnect = async (integrationId: string, provider: string) => {
    try {
      const { error: err } = await supabase
        .from('oauth_integrations')
        .delete()
        .eq('id', integrationId);

      if (err) throw err;

      setIntegrations(integrations.filter(i => i.id !== integrationId));
    } catch (err) {
      setError('Failed to disconnect. Please try again.');
    }
  };

  const googleIntegration = integrations.find(i => i.provider === 'google');
  const zoomIntegration = integrations.find(i => i.provider === 'zoom');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Calendar Integrations</h2>
        <p className="text-gray-600">
          Connect your Google Calendar or Zoom account to automatically record, transcribe, and summarize meetings.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="text-blue-500" size={28} />
            <h3 className="text-lg font-semibold text-gray-800">Google Calendar & Meet</h3>
          </div>

          <p className="text-gray-600 text-sm mb-4">
            Access your Google Calendar and automatically record Google Meet sessions with transcription and summaries.
          </p>

          {googleIntegration ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="font-medium text-green-900">Connected</p>
                  <p className="text-sm text-green-800">{googleIntegration.email}</p>
                </div>
              </div>
              <button
                onClick={() => handleDisconnect(googleIntegration.id, 'google')}
                className="w-full px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleConnect}
              disabled={connecting === 'google'}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {connecting === 'google' ? (
                <>
                  <Loader className="animate-spin" size={18} />
                  Connecting...
                </>
              ) : (
                'Connect Google'
              )}
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Video className="text-blue-400" size={28} />
            <h3 className="text-lg font-semibold text-gray-800">Zoom</h3>
          </div>

          <p className="text-gray-600 text-sm mb-4">
            Connect your Zoom account to automatically record, transcribe, and generate summaries of your Zoom meetings.
          </p>

          {zoomIntegration ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="font-medium text-green-900">Connected</p>
                  <p className="text-sm text-green-800">{zoomIntegration.email}</p>
                </div>
              </div>
              <button
                onClick={() => handleDisconnect(zoomIntegration.id, 'zoom')}
                className="w-full px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleZoomConnect}
              disabled={connecting === 'zoom'}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {connecting === 'zoom' ? (
                <>
                  <Loader className="animate-spin" size={18} />
                  Connecting...
                </>
              ) : (
                'Connect Zoom'
              )}
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How it works</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Connect your calendar to view upcoming meetings</li>
          <li>Meetings are automatically recorded when they start</li>
          <li>Real-time transcription with language translation</li>
          <li>Auto-generated summaries with key points and action items</li>
          <li>Meeting notes are sent to all attendees via email</li>
        </ul>
      </div>
    </div>
  );
};
