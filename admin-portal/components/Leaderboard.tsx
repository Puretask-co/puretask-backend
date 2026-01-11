/**
 * Leaderboard Component
 * 
 * Features:
 * - Top cleaners by points
 * - Different leaderboard categories
 * - Personal ranking display
 * - Time period filters (week, month, all-time)
 * - Achievement showcase
 * - Certification badges
 * - Animated rankings
 */

import React, { useState, useEffect } from 'react';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  photoUrl?: string;
  points: number;
  achievementCount: number;
  certificationLevel: number;
  bookingsCompleted: number;
  rating: number;
  isCurrentUser: boolean;
}

type LeaderboardCategory = 'points' | 'bookings' | 'rating' | 'achievements';
type TimePeriod = 'week' | 'month' | 'all';

export const Leaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [category, setCategory] = useState<LeaderboardCategory>('points');
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [category, period]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration - replace with actual API call
      const mockData: LeaderboardEntry[] = [
        {
          rank: 1,
          userId: '1',
          name: 'Sarah Johnson',
          photoUrl: 'https://i.pravatar.cc/150?img=1',
          points: 1250,
          achievementCount: 12,
          certificationLevel: 4,
          bookingsCompleted: 156,
          rating: 4.9,
          isCurrentUser: false,
        },
        {
          rank: 2,
          userId: '2',
          name: 'Michael Chen',
          photoUrl: 'https://i.pravatar.cc/150?img=2',
          points: 1180,
          achievementCount: 11,
          certificationLevel: 3,
          bookingsCompleted: 142,
          rating: 4.8,
          isCurrentUser: false,
        },
        {
          rank: 3,
          userId: '3',
          name: 'Emily Rodriguez',
          photoUrl: 'https://i.pravatar.cc/150?img=3',
          points: 1050,
          achievementCount: 10,
          certificationLevel: 3,
          bookingsCompleted: 128,
          rating: 4.9,
          isCurrentUser: false,
        },
        {
          rank: 4,
          userId: '4',
          name: 'David Kim',
          points: 980,
          achievementCount: 9,
          certificationLevel: 3,
          bookingsCompleted: 115,
          rating: 4.7,
          isCurrentUser: false,
        },
        {
          rank: 5,
          userId: '5',
          name: 'You',
          photoUrl: 'https://i.pravatar.cc/150?img=5',
          points: 825,
          achievementCount: 8,
          certificationLevel: 2,
          bookingsCompleted: 98,
          rating: 4.8,
          isCurrentUser: true,
        },
      ];

      setEntries(mockData);
      setUserRank(mockData.find(e => e.isCurrentUser) || null);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (cat: LeaderboardCategory) => {
    switch (cat) {
      case 'points': return 'Total Points';
      case 'bookings': return 'Bookings Completed';
      case 'rating': return 'Star Rating';
      case 'achievements': return 'Achievements Earned';
    }
  };

  const getCategoryValue = (entry: LeaderboardEntry) => {
    switch (category) {
      case 'points': return `${entry.points} pts`;
      case 'bookings': return `${entry.bookingsCompleted} bookings`;
      case 'rating': return `${entry.rating} ⭐`;
      case 'achievements': return `${entry.achievementCount} badges`;
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getCertificationBadge = (level: number) => {
    switch (level) {
      case 1: return { icon: '🎓', color: 'bg-green-500', name: 'Beginner' };
      case 2: return { icon: '⚡', color: 'bg-blue-500', name: 'Pro' };
      case 3: return { icon: '🏆', color: 'bg-purple-500', name: 'Expert' };
      case 4: return { icon: '👑', color: 'bg-red-500', name: 'Master' };
      default: return { icon: '', color: 'bg-gray-500', name: 'None' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-3xl font-bold mb-2">🏆 Leaderboard</h2>
        <p className="text-lg opacity-90">
          See how you rank against other cleaners on PureTask
        </p>
      </div>

      {/* User's Current Rank */}
      {userRank && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                {userRank.photoUrl ? (
                  <img src={userRank.photoUrl} alt="You" className="w-full h-full rounded-full" />
                ) : (
                  <span className="text-4xl">👤</span>
                )}
              </div>
              <div>
                <div className="text-2xl font-bold">Your Rank: {getRankIcon(userRank.rank)}</div>
                <div className="text-lg opacity-90">{getCategoryValue(userRank)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-90">Keep going!</div>
              <div className="text-lg font-semibold">
                {userRank.rank > 1 && entries[userRank.rank - 2] && (
                  <>
                    {category === 'points' && (
                      <>+{entries[userRank.rank - 2].points - userRank.points} pts to #{userRank.rank - 1}</>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          {/* Category */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {(['points', 'bookings', 'rating', 'achievements'] as LeaderboardCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    category === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {getCategoryLabel(cat)}
                </button>
              ))}
            </div>
          </div>

          {/* Time Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
            <div className="flex gap-2">
              {(['week', 'month', 'all'] as TimePeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    period === p
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {p === 'all' ? 'All-Time' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">🏆 Top 3 Cleaners</h3>
        
        <div className="flex items-end justify-center space-x-4 mb-8">
          {/* 2nd Place */}
          {entries[1] && (
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center mb-2">
                {entries[1].photoUrl ? (
                  <img src={entries[1].photoUrl} alt={entries[1].name} className="w-full h-full rounded-full" />
                ) : (
                  <span className="text-4xl">🥈</span>
                )}
              </div>
              <div className="bg-gray-200 rounded-lg p-4 w-32 h-24 flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-gray-700">#2</div>
                <div className="text-sm font-medium text-gray-800 text-center">{entries[1].name}</div>
                <div className="text-xs text-gray-600">{getCategoryValue(entries[1])}</div>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {entries[0] && (
            <div className="flex flex-col items-center">
              <div className="text-3xl mb-2">👑</div>
              <div className="w-32 h-32 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full flex items-center justify-center mb-2 animate-pulse">
                {entries[0].photoUrl ? (
                  <img src={entries[0].photoUrl} alt={entries[0].name} className="w-full h-full rounded-full" />
                ) : (
                  <span className="text-5xl">🥇</span>
                )}
              </div>
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg p-4 w-40 h-28 flex flex-col items-center justify-center text-white">
                <div className="text-3xl font-bold">#1</div>
                <div className="text-sm font-medium text-center">{entries[0].name}</div>
                <div className="text-xs">{getCategoryValue(entries[0])}</div>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {entries[2] && (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-300 to-orange-500 rounded-full flex items-center justify-center mb-2">
                {entries[2].photoUrl ? (
                  <img src={entries[2].photoUrl} alt={entries[2].name} className="w-full h-full rounded-full" />
                ) : (
                  <span className="text-3xl">🥉</span>
                )}
              </div>
              <div className="bg-orange-200 rounded-lg p-4 w-28 h-20 flex flex-col items-center justify-center">
                <div className="text-xl font-bold text-orange-700">#3</div>
                <div className="text-xs font-medium text-orange-800 text-center">{entries[2].name}</div>
                <div className="text-xs text-orange-600">{getCategoryValue(entries[2])}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cleaner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Certification
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getCategoryLabel(category)}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Achievements
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.map((entry, index) => {
                const badge = getCertificationBadge(entry.certificationLevel);
                return (
                  <tr 
                    key={entry.userId}
                    className={`transition-colors ${
                      entry.isCurrentUser 
                        ? 'bg-blue-50 border-l-4 border-blue-600' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-2xl font-bold">
                        {getRankIcon(entry.rank)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {entry.photoUrl ? (
                            <img 
                              className="h-10 w-10 rounded-full" 
                              src={entry.photoUrl} 
                              alt={entry.name} 
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              👤
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className={`text-sm font-medium ${
                            entry.isCurrentUser ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            {entry.name}
                            {entry.isCurrentUser && (
                              <span className="ml-2 text-xs text-blue-600">(You)</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {entry.rating} ⭐ • {entry.bookingsCompleted} bookings
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {entry.certificationLevel > 0 ? (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white ${badge.color}`}>
                          <span className="mr-1">{badge.icon}</span>
                          {badge.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">No certification</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-gray-900">
                        {getCategoryValue(entry)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {entry.achievementCount} 🏆
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Motivation Card */}
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 border-2 border-pink-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">💪 Keep Climbing!</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">🎯</span>
            <div>
              <h4 className="font-semibold text-gray-900">Set Goals</h4>
              <p className="text-sm text-gray-600">Aim for the next rank and celebrate milestones</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-2xl">📚</span>
            <div>
              <h4 className="font-semibold text-gray-900">Learn & Grow</h4>
              <p className="text-sm text-gray-600">Use AI features to boost your performance</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-2xl">🤝</span>
            <div>
              <h4 className="font-semibold text-gray-900">Help Others</h4>
              <p className="text-sm text-gray-600">Share templates and mentor new cleaners</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;

