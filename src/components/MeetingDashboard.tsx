import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, FileText, Send, Download } from 'lucide-react';
import { supabase, Meeting, Transcription, MeetingSummary, Attendee } from '../lib/supabase';
import { summarizationService } from '../services/summarization';

export const MeetingDashboard = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingNotifications, setSendingNotifications] = useState(false);

  useEffect(() => {
    loadMeetings();
  }, []);

  useEffect(() => {
    if (selectedMeeting) {
      loadMeetingDetails(selectedMeeting.id);
    }
  }, [selectedMeeting]);

  const loadMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMeetingDetails = async (meetingId: string) => {
    try {
      const [transRes, summaryRes, attendeesRes] = await Promise.all([
        supabase
          .from('transcriptions')
          .select('*')
          .eq('meeting_id', meetingId)
          .order('timestamp_start', { ascending: true }),
        supabase
          .from('meeting_summaries')
          .select('*')
          .eq('meeting_id', meetingId)
          .maybeSingle(),
        supabase
          .from('attendees')
          .select('*')
          .eq('meeting_id', meetingId),
      ]);

      setTranscriptions(transRes.data || []);
      setSummary(summaryRes.data);
      setAttendees(attendeesRes.data || []);

      if (!summaryRes.data && transRes.data && transRes.data.length > 0) {
        generateSummary(meetingId, transRes.data);
      }
    } catch (error) {
      console.error('Error loading meeting details:', error);
    }
  };

  const generateSummary = async (meetingId: string, trans: Transcription[]) => {
    try {
      const summaryData = await summarizationService.generateSummary(trans);

      const { data, error } = await supabase
        .from('meeting_summaries')
        .insert({
          meeting_id: meetingId,
          summary: summaryData.summary,
          key_points: summaryData.keyPoints,
          action_items: summaryData.actionItems,
        })
        .select()
        .single();

      if (error) throw error;
      setSummary(data);
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  };

  const sendNotifications = async () => {
    if (!selectedMeeting || !summary) return;

    setSendingNotifications(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-meeting-notifications`;

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId: selectedMeeting.id,
          meetingTitle: selectedMeeting.title,
          summary: summary.summary,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`Notifications sent successfully to ${result.count} attendees!`);
        loadMeetingDetails(selectedMeeting.id);
      } else {
        throw new Error(result.error || 'Failed to send notifications');
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
      alert('Failed to send notifications. Please try again.');
    } finally {
      setSendingNotifications(false);
    }
  };

  const downloadTranscript = () => {
    if (!transcriptions.length || !selectedMeeting) return;

    const transcript = transcriptions
      .map(t => {
        const time = new Date(t.timestamp_start).toLocaleTimeString();
        return `[${time}] ${t.translated_text || t.original_text}`;
      })
      .join('\n\n');

    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMeeting.title.replace(/[^a-z0-9]/gi, '_')}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Meeting Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Recent Meetings</h2>

            {meetings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No meetings yet</p>
            ) : (
              <div className="space-y-2">
                {meetings.map((meeting) => (
                  <button
                    key={meeting.id}
                    onClick={() => setSelectedMeeting(meeting)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedMeeting?.id === meeting.id
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <h3 className="font-medium text-gray-800 truncate">{meeting.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <Calendar size={12} />
                      {new Date(meeting.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          meeting.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : meeting.status === 'recording'
                            ? 'bg-red-100 text-red-800'
                            : meeting.status === 'processing'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {meeting.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedMeeting ? (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">{selectedMeeting.title}</h2>
                    <p className="text-gray-500 text-sm mt-1">
                      {new Date(selectedMeeting.start_time).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {transcriptions.length > 0 && (
                      <button
                        onClick={downloadTranscript}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                      >
                        <Download size={16} />
                        Download
                      </button>
                    )}
                    {attendees.length > 0 && summary && (
                      <button
                        onClick={sendNotifications}
                        disabled={sendingNotifications}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <Send size={16} />
                        {sendingNotifications ? 'Sending...' : 'Notify Attendees'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={16} />
                    <span className="text-sm">
                      Duration: {formatDuration(selectedMeeting.duration_seconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users size={16} />
                    <span className="text-sm">{attendees.length} Attendees</span>
                  </div>
                </div>

                {attendees.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Attendees</h3>
                    <div className="space-y-2">
                      {attendees.map((attendee) => (
                        <div key={attendee.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <p className="font-medium text-gray-800">{attendee.name}</p>
                            <p className="text-sm text-gray-500">{attendee.email}</p>
                          </div>
                          {attendee.notification_sent && (
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                              Notified
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {summary && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <FileText size={20} />
                        Summary
                      </h3>
                      <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{summary.summary}</p>
                    </div>

                    {summary.key_points && summary.key_points.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Key Points</h3>
                        <ul className="list-disc list-inside space-y-1 text-gray-700">
                          {summary.key_points.map((point, index) => (
                            <li key={index}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {summary.action_items && summary.action_items.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Action Items</h3>
                        <ul className="list-disc list-inside space-y-1 text-gray-700">
                          {summary.action_items.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {transcriptions.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Full Transcript</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {transcriptions.map((trans) => (
                      <div key={trans.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs text-gray-500">
                            {new Date(trans.timestamp_start).toLocaleTimeString()}
                          </span>
                          {trans.original_language !== 'en' && (
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              Translated from {trans.original_language}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700">{trans.translated_text || trans.original_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <FileText size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Select a meeting to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
