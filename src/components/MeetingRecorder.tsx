import { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, Square, Play, Pause } from 'lucide-react';
import { useMediaRecorder } from '../hooks/useMediaRecorder';
import { supabase } from '../lib/supabase';
import { VoskTranscriptionService, convertAudioToFloat32 } from '../services/vosk';
import { translationService } from '../services/translation';

interface Attendee {
  name: string;
  email: string;
}

interface MeetingRecorderProps {
  onMeetingComplete: (meetingId: string) => void;
}

export const MeetingRecorder = ({ onMeetingComplete }: MeetingRecorderProps) => {
  const [meetingTitle, setMeetingTitle] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([{ name: '', email: '' }]);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [includeVideo, setIncludeVideo] = useState(true);
  const [transcripts, setTranscripts] = useState<Array<{ text: string; timestamp: number }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const voskServiceRef = useRef<VoskTranscriptionService | null>(null);

  const {
    recordingState,
    recordedBlob,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    reset,
    stream,
  } = useMediaRecorder();

  useEffect(() => {
    if (stream && videoRef.current && includeVideo) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, includeVideo]);

  useEffect(() => {
    return () => {
      if (voskServiceRef.current) {
        voskServiceRef.current.terminate();
      }
    };
  }, []);

  const addAttendee = () => {
    setAttendees([...attendees, { name: '', email: '' }]);
  };

  const updateAttendee = (index: number, field: 'name' | 'email', value: string) => {
    const newAttendees = [...attendees];
    newAttendees[index][field] = value;
    setAttendees(newAttendees);
  };

  const removeAttendee = (index: number) => {
    if (attendees.length > 1) {
      setAttendees(attendees.filter((_, i) => i !== index));
    }
  };

  const handleStartRecording = async () => {
    if (!meetingTitle.trim()) {
      alert('Please enter a meeting title');
      return;
    }

    try {
      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
          title: meetingTitle,
          status: 'recording',
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentMeetingId(meeting.id);

      const validAttendees = attendees.filter(a => a.name && a.email);
      if (validAttendees.length > 0) {
        await supabase.from('attendees').insert(
          validAttendees.map(a => ({
            meeting_id: meeting.id,
            name: a.name,
            email: a.email,
          }))
        );
      }

      await startRecording(includeVideo);

      voskServiceRef.current = new VoskTranscriptionService();
      await voskServiceRef.current.initialize();

      voskServiceRef.current.onTranscript(async (text, timestamp, confidence) => {
        setTranscripts(prev => [...prev, { text, timestamp }]);

        const translation = await translationService.translate(text);

        await supabase.from('transcriptions').insert({
          meeting_id: meeting.id,
          original_text: text,
          original_language: translation.detectedLanguage,
          translated_text: translation.translatedText,
          timestamp_start: timestamp,
          timestamp_end: timestamp + 3000,
          confidence: confidence,
        });
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please try again.');
    }
  };

  const handleStopRecording = async () => {
    stopRecording();

    if (voskServiceRef.current) {
      voskServiceRef.current.finalize();
    }

    if (currentMeetingId) {
      await supabase
        .from('meetings')
        .update({
          status: 'processing',
          end_time: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq('id', currentMeetingId);
    }
  };

  useEffect(() => {
    if (recordedBlob && currentMeetingId) {
      processRecording();
    }
  }, [recordedBlob, currentMeetingId]);

  const processRecording = async () => {
    if (!recordedBlob || !currentMeetingId) return;

    try {
      await supabase
        .from('meetings')
        .update({ status: 'processing' })
        .eq('id', currentMeetingId);

      if (voskServiceRef.current) {
        await convertAudioToFloat32(recordedBlob, (chunk, timestamp) => {
          voskServiceRef.current?.processAudioChunk(chunk, timestamp);
        });

        voskServiceRef.current.finalize();
        voskServiceRef.current.terminate();
      }

      setTimeout(async () => {
        await supabase
          .from('meetings')
          .update({ status: 'completed' })
          .eq('id', currentMeetingId);

        onMeetingComplete(currentMeetingId);
        reset();
        setCurrentMeetingId(null);
        setTranscripts([]);
        setMeetingTitle('');
        setAttendees([{ name: '', email: '' }]);
      }, 2000);
    } catch (error) {
      console.error('Error processing recording:', error);
      await supabase
        .from('meetings')
        .update({ status: 'failed' })
        .eq('id', currentMeetingId);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">New Meeting Recording</h2>

        {recordingState === 'idle' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meeting Title
              </label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter meeting title"
              />
            </div>

            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                <input
                  type="checkbox"
                  checked={includeVideo}
                  onChange={(e) => setIncludeVideo(e.target.checked)}
                  className="rounded"
                />
                <span>Include Video</span>
              </label>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Attendees
                </label>
                <button
                  onClick={addAttendee}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Attendee
                </button>
              </div>

              {attendees.map((attendee, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={attendee.name}
                    onChange={(e) => updateAttendee(index, 'name', e.target.value)}
                    placeholder="Name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="email"
                    value={attendee.email}
                    onChange={(e) => updateAttendee(index, 'email', e.target.value)}
                    placeholder="Email"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {attendees.length > 1 && (
                    <button
                      onClick={() => removeAttendee(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleStartRecording}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
            >
              {includeVideo ? <Video size={20} /> : <Mic size={20} />}
              Start Recording
            </button>
          </div>
        )}

        {(recordingState === 'recording' || recordingState === 'paused') && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">{meetingTitle}</h3>
              <div className="text-4xl font-mono text-blue-600 mb-4">
                {formatDuration(duration)}
              </div>
              <div className="flex items-center justify-center gap-2 mb-4">
                {recordingState === 'recording' && (
                  <span className="flex items-center gap-2 text-red-600">
                    <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></span>
                    Recording
                  </span>
                )}
                {recordingState === 'paused' && (
                  <span className="text-gray-600">Paused</span>
                )}
              </div>
            </div>

            {includeVideo && stream && (
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full"
                />
              </div>
            )}

            <div className="flex gap-2 justify-center">
              {recordingState === 'recording' && (
                <button
                  onClick={pauseRecording}
                  className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-2"
                >
                  <Pause size={20} />
                  Pause
                </button>
              )}
              {recordingState === 'paused' && (
                <button
                  onClick={resumeRecording}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Play size={20} />
                  Resume
                </button>
              )}
              <button
                onClick={handleStopRecording}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Square size={20} />
                Stop Recording
              </button>
            </div>

            {transcripts.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Live Transcription</h4>
                {transcripts.slice(-5).map((t, i) => (
                  <p key={i} className="text-sm text-gray-600">
                    {t.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {recordingState === 'stopped' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Processing recording and generating summary...</p>
          </div>
        )}
      </div>
    </div>
  );
};
