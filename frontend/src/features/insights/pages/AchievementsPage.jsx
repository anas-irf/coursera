import React, { useEffect, useState } from 'react';

import { formatDate } from '../../../shared/lib/time';
import { PageSpinner } from '../../../shared/ui/Spinner';
import * as insightsApi from '../api';

const AchievementsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    insightsApi
      .fetchAchievements()
      .then((result) => !cancelled && setData(result))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <PageSpinner />;
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Your achievements could not be loaded. Please try again later.</p>
      </div>
    );
  }

  const toNext = data.next_level_points - data.total_points;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Achievements</h1>
        <p className="text-indigo-100">Track your learning milestones and unlock badges</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold">{data.total_points}</div>
            <div className="text-sm text-indigo-100">Points</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold">{data.current_level}</div>
            <div className="text-sm text-indigo-100">Level</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold">{toNext}</div>
            <div className="text-sm text-indigo-100">Points to next level</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold">#{data.global_rank}</div>
            <div className="text-sm text-indigo-100">Global rank</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`bg-white rounded-xl p-6 shadow-sm border-2 transition-all duration-200 ${
              achievement.earned ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-indigo-200'
            }`}
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className={`p-3 rounded-full text-3xl ${achievement.earned ? 'bg-green-100' : 'bg-gray-100'}`}>
                {achievement.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{achievement.title}</h3>
                {achievement.earned && achievement.date && (
                  <p className="text-sm text-green-600">Earned {formatDate(achievement.date)}</p>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">{achievement.description}</p>

            {!achievement.earned && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium">{Math.round(achievement.progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full"
                    style={{ width: `${achievement.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AchievementsPage;
