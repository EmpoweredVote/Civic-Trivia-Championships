import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Avatar } from '../components/Avatar';
import { XpIcon } from '../components/icons/XpIcon';
import { GemIcon } from '../components/icons/GemIcon';
import { fetchProfile, uploadAvatar, updateTimerMultiplier, updateName, updatePassword, ProfileStats } from '../services/profileService';
import { useAuthStore } from '../store/authStore';
import type { AuthError } from '../types/auth';

export function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [updatingTimer, setUpdatingTimer] = useState(false);

  // Name editing state
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProfile();
      setProfile(data);
      // Sync timer multiplier to auth store
      useAuthStore.getState().setTimerMultiplier(data.timerMultiplier);
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

  const handleTimerMultiplierChange = async (multiplier: number) => {
    setUpdatingTimer(true);
    try {
      await updateTimerMultiplier(multiplier);
      // Update local profile state
      if (profile) {
        setProfile({
          ...profile,
          timerMultiplier: multiplier,
        });
      }
      // Update auth store for gameplay
      useAuthStore.getState().setTimerMultiplier(multiplier);
    } catch (err: any) {
      setError(err?.error || 'Failed to update timer setting');
    } finally {
      setUpdatingTimer(false);
    }
  };

  const handleStartEditName = () => {
    setNameInput(profile?.name || '');
    setNameError(null);
    setEditingName(true);
  };

  const handleCancelEditName = () => {
    setNameInput('');
    setNameError(null);
    setEditingName(false);
  };

  const handleSaveName = async () => {
    // Client-side validation
    const trimmed = nameInput.trim();
    if (trimmed.length < 2 || trimmed.length > 50) {
      setNameError('Name must be between 2 and 50 characters');
      return;
    }

    setSavingName(true);
    setNameError(null);
    try {
      const result = await updateName(trimmed);
      if (profile) {
        setProfile({ ...profile, name: result.name });
      }
      useAuthStore.getState().setUserName(result.name);
      setEditingName(false);
    } catch (err: any) {
      const authErr = err as AuthError;
      if (authErr?.errors && authErr.errors.length > 0) {
        setNameError(authErr.errors.map(e => e.message).join('. '));
      } else if (authErr?.error) {
        setNameError(authErr.error);
      } else {
        setNameError('Failed to update name');
      }
    } finally {
      setSavingName(false);
    }
  };

  const handleCancelPassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(null);
    setShowPasswordForm(false);
  };

  const handleSubmitPassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    // Client-side: confirm match
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    // Client-side: validate strength
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setPasswordError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setPasswordError('Password must contain at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setPasswordError('Password must contain at least one number');
      return;
    }

    setSavingPassword(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setPasswordSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Hide form after 2 seconds
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(null);
      }, 2000);
    } catch (err: any) {
      const authErr = err as AuthError;
      if (authErr?.errors && authErr.errors.length > 0) {
        setPasswordError(authErr.errors.map(e => e.message).join('. '));
      } else if (authErr?.error) {
        setPasswordError(authErr.error);
      } else {
        setPasswordError('Failed to update password');
      }
    } finally {
      setSavingPassword(false);
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
              {/* Name - inline edit */}
              {editingName ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') handleCancelEditName();
                    }}
                    autoFocus
                    className="bg-slate-700 text-white rounded px-3 py-1 text-2xl font-bold border border-slate-600 focus:border-teal-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="px-3 py-1 bg-teal-600 text-white text-sm font-semibold rounded hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingName ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelEditName}
                    disabled={savingName}
                    className="px-3 py-1 bg-slate-600 text-white text-sm font-semibold rounded hover:bg-slate-500 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <h1 className="text-3xl font-bold text-white">{profile.name}</h1>
                  <button
                    onClick={handleStartEditName}
                    className="text-slate-400 hover:text-teal-400 transition-colors p-1"
                    title="Edit name"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                </div>
              )}
              {nameError && (
                <p className="text-red-400 text-sm mt-1">{nameError}</p>
              )}

              <p className="text-slate-400 mt-1">{profile.email}</p>

              {/* Change Password */}
              {!showPasswordForm ? (
                <button
                  onClick={() => { setPasswordError(null); setPasswordSuccess(null); setShowPasswordForm(true); }}
                  className="text-teal-400 hover:text-teal-300 text-sm mt-1 transition-colors"
                >
                  Change Password
                </button>
              ) : (
                <div className="mt-3 bg-slate-700/50 rounded-lg p-4 max-w-sm space-y-3">
                  <h3 className="text-sm font-semibold text-white">Change Password</h3>
                  <input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm border border-slate-600 focus:border-teal-500 focus:outline-none"
                  />
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm border border-slate-600 focus:border-teal-500 focus:outline-none"
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitPassword(); }}
                    className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm border border-slate-600 focus:border-teal-500 focus:outline-none"
                  />
                  {passwordError && (
                    <p className="text-red-400 text-sm">{passwordError}</p>
                  )}
                  {passwordSuccess && (
                    <p className="text-green-400 text-sm">{passwordSuccess}</p>
                  )}
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSubmitPassword}
                      disabled={savingPassword}
                      className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPassword ? 'Saving...' : 'Update Password'}
                    </button>
                    <button
                      onClick={handleCancelPassword}
                      disabled={savingPassword}
                      className="px-4 py-2 bg-slate-600 text-white text-sm font-semibold rounded hover:bg-slate-500 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

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
              <p className="text-slate-400">
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

        {/* Settings section */}
        <div className="bg-slate-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>

          <div className="space-y-6">
            {/* Extended Time setting */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Extended Time</h3>
                <p className="text-sm text-slate-400 mt-1">Adjusts the timer for all questions</p>
              </div>

              <div className="flex space-x-2">
                {[1.0, 1.5, 2.0].map((multiplier) => (
                  <button
                    key={multiplier}
                    onClick={() => handleTimerMultiplierChange(multiplier)}
                    disabled={updatingTimer}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      profile.timerMultiplier === multiplier
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    } ${updatingTimer ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {multiplier}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
