import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { AuthForm } from './components/AuthForm';
import { MeetingRecorder } from './components/MeetingRecorder';
import { MeetingDashboard } from './components/MeetingDashboard';
import { IntegrationSetup } from './components/IntegrationSetup';
import { ScheduledMeetings } from './components/ScheduledMeetings';
import { Video, History, LogOut, Settings, Calendar } from 'lucide-react';

type View = 'dashboard' | 'recorder' | 'integrations' | 'scheduled';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleMeetingComplete = (meetingId: string) => {
    setCurrentView('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Video className="text-blue-600" size={28} />
              <h1 className="text-2xl font-bold text-gray-800">Meeting Recorder</h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
                  currentView === 'dashboard'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <History size={16} />
                Dashboard
              </button>

              <button
                onClick={() => setCurrentView('recorder')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
                  currentView === 'recorder'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Video size={16} />
                Record
              </button>

              <button
                onClick={() => setCurrentView('scheduled')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
                  currentView === 'scheduled'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Calendar size={16} />
                Scheduled
              </button>

              <button
                onClick={() => setCurrentView('integrations')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
                  currentView === 'integrations'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings size={16} />
                Integrations
              </button>

              <button
                onClick={handleSignOut}
                className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8">
        {currentView === 'dashboard' && <MeetingDashboard />}
        {currentView === 'recorder' && <MeetingRecorder onMeetingComplete={handleMeetingComplete} />}
        {currentView === 'scheduled' && <ScheduledMeetings />}
        {currentView === 'integrations' && <IntegrationSetup />}
      </main>
    </div>
  );
}

export default App;
