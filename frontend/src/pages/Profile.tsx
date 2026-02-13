import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Avatar } from '../components/Avatar';
import { XpIcon } from '../components/icons/XpIcon';
import { GemIcon } from '../components/icons/GemIcon';
import { fetchProfile, uploadAvatar, ProfileStats } from '../services/profileService';

export function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProfile();
      setProfile(data);
    } catch (err: any) {
      setError(err?.error || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleAvatarUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);

    try {
      const result = await uploadAvatar(file);
      // Update local state with new avatar URL
      if (profile) {
        setProfile({
          ...profile,
          avatarUrl: result.avatarUrl,
        });
      }
    } catch (err: any) {
      setUploadError(err?.error || 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <p className="text-red-400 text-lg">{error}</p>
            <button
              onClick={loadProfile}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Hero section - Identity focused */}
        <div className="bg-slate-800 rounded-lg p-8">
          <div className="flex items-start space-x-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <Avatar
                name={profile.name}
                imageUrl={profile.avatarUrl}
                size={80}
                onUpload={handleAvatarUpload}
              />
              {uploading && (
                <p className="text-xs text-slate-400 mt-2 text-center">Uploading...</p>
              )}
              {uploadError && (
                <p className="text-xs text-red-400 mt-2 text-center">{uploadError}</p>
              )}
            </div>

            {/* Identity and currency */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white">{profile.name}</h1>
              <p className="text-slate-400 mt-1">{profile.email}</p>

              {/* XP and Gems totals */}
              <div className="flex items-center space-x-6 mt-4">
                {/* XP */}
                <div className="flex items-center space-x-2">
                  <XpIcon className="w-6 h-6 text-cyan-400" />
                  <span className="text-2xl font-bold text-cyan-400">
                    {profile.totalXp.toLocaleString()}
                  </span>
                  <span className="text-slate-400">XP</span>
                </div>

                {/* Gems */}
                <div className="flex items-center space-x-2">
                  <GemIcon className="w-6 h-6 text-purple-400" />
                  <span className="text-2xl font-bold text-purple-400">
                    {profile.totalGems.toLocaleString()}
                  </span>
                  <span className="text-slate-400">Gems</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats section */}
        <div className="bg-slate-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Statistics</h2>

          {profile.gamesPlayed === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <p className="text-lg text-slate-400">No games played yet!</p>
              <p className="text-slate-500">
                Play your first game to start tracking your stats.
              </p>
              <button
                onClick={() => navigate('/play')}
                className="mt-4 px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors"
              >
                Play Your First Game
              </button>
            </div>
          ) : (
            // Stats list
            <div className="space-y-0">
              <div className="flex justify-between items-center py-3 border-b border-slate-700">
                <span className="text-slate-300">Games Played</span>
                <span className="text-white font-semibold">{profile.gamesPlayed}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-slate-700">
                <span className="text-slate-300">Best Score</span>
                <span className="text-white font-semibold">
                  {profile.bestScore.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center py-3">
                <span className="text-slate-300">Overall Accuracy</span>
                <span className="text-white font-semibold">{profile.overallAccuracy}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
