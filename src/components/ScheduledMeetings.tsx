import { useState, useEffect } from 'react';
import { Calendar, Video, Clock, Users, Loader, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { googleIntegrationService, type GoogleMeetEvent } from '../services/googleIntegration';
import { zoomIntegrationService, type ZoomMeeting } from '../services/zoomIntegration';

interface CombinedMeeting {
  id: string;
  provider: 'google_meet' | 'zoom';
  title: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  meetingLink: string;
  attendeeCount?: number;
  recordingStatus: 'pending' | 'recording' | 'completed' | 'failed';
}

export const ScheduledMeetings = () => {
  const [meetings, setMeetings] = useState<CombinedMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<CombinedMeeting | null>(null);

  useEffect(() => {
    loadMeetings();
    const interval = setInterval(loadMeetings, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadMeetings = async () => {
    try {
      setError(null);
      const [googleMeetings, zoomMeetings] = await Promise.all([
        googleIntegrationService.getUpcomingMeetings(),
        zoomIntegrationService.getUpcomingMeetings(),
      ]);

      const combinedMeetings: CombinedMeeting[] = [
        ...googleMeetings.map((event: GoogleMeetEvent) => ({
          id: event.id,
          provider: 'google_meet' as const,
          title: event.summary,
          startTime: event.startTime,
          endTime: event.endTime,
          meetingLink: event.conferenceData?.entryPoints?.[0]?.uri || '',
          recordingStatus: 'pending' as const,
        })),
        ...zoomMeetings.map((meeting: ZoomMeeting) => ({
          id: meeting.uuid,
          provider: 'zoom' as const,
          title: meeting.topic,
          startTime: meeting.start_time,
          duration: meeting.duration,
          meetingLink: meeting.join_url,
          recordingStatus: 'pending' as const,
        })),
      ];

      combinedMeetings.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      setMeetings(combinedMeetings);
    } catch (err) {
      console.error('Error loading meetings:', err);
      setError('Failed to load meetings. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMeetings();
  };

  const getTimeUntilMeeting = (startTime: string): string => {
    const now = new Date();
    const meetingTime = new Date(startTime);
    const diffMs = meetingTime.getTime() - now.getTime();

    if (diffMs < 0) return 'Started';

    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 24) {
      return `in ${Math.floor(hours / 24)}d`;
    } else if (hours > 0) {
      return `in ${hours}h ${mins}m`;
    }
    return `in ${mins}m`;
  };

  const isMeetingUpcoming = (startTime: string): boolean => {
    const now = new Date();
    const meetingTime = new Date(startTime);
    return meetingTime.getTime() > now.getTime();
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Scheduled Meetings</h2>
          <p className="text-gray-600 mt-1">View and manage your upcoming Google Meet and Zoom meetings</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {meetings.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 text-lg">No upcoming meetings scheduled</p>
          <p className="text-gray-500 text-sm mt-2">
            Connect your calendar to see your upcoming meetings
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.map((meeting) => {
            const timeUntil = getTimeUntilMeeting(meeting.startTime);
            const upcoming = isMeetingUpcoming(meeting.startTime);

            return (
              <button
                key={`${meeting.provider}-${meeting.id}`}
                onClick={() => setSelectedMeeting(meeting)}
                className={`text-left rounded-lg shadow-lg overflow-hidden transition-transform hover:shadow-xl ${
                  selectedMeeting?.id === meeting.id
                    ? 'ring-2 ring-blue-500'
                    : ''
                } ${upcoming ? 'bg-white' : 'bg-gray-50'}`}
              >
                <div className={`p-4 ${upcoming ? 'bg-blue-50' : 'bg-gray-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium">
                      {meeting.provider === 'google_meet' ? (
                        <>
                          <Calendar size={14} className="text-blue-600" />
                          <span className="text-blue-600">Google Meet</span>
                        </>
                      ) : (
                        <>
                          <Video size={14} className="text-blue-400" />
                          <span className="text-blue-400">Zoom</span>
                        </>
                      )}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        upcoming
                          ? 'bg-blue-200 text-blue-800'
                          : 'bg-gray-300 text-gray-700'
                      }`}
                    >
                      {meeting.recordingStatus}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-800 truncate">
                    {meeting.title}
                  </h3>
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock size={16} />
                    <span>
                      {formatDate(meeting.startTime)} at {formatTime(meeting.startTime)}
                    </span>
                  </div>

                  {upcoming && (
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-green-600">{timeUntil}</span>
                    </div>
                  )}

                  <a
                    href={meeting.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block text-blue-600 hover:text-blue-800 text-sm font-medium mt-2"
                  >
                    Join meeting →
                  </a>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">{selectedMeeting.title}</h3>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar size={18} />
                <span>
                  {formatDate(selectedMeeting.startTime)} at {formatTime(selectedMeeting.startTime)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-gray-700">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {selectedMeeting.provider === 'google_meet' ? 'Google Meet' : 'Zoom'}
                </span>
              </div>
            </div>

            <a
              href={selectedMeeting.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center mb-3 block"
            >
              Join Meeting
            </a>

            <button
              onClick={() => setSelectedMeeting(null)}
              className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
