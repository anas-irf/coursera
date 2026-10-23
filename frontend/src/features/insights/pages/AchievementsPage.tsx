import React from 'react';
import { CheckCircle2, Globe2, Lock, Medal, Sparkles, Star, Target } from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import { formatDate } from '../../../shared/lib/time';
import { Badge } from '../../../shared/ui/Badge';
import { Card } from '../../../shared/ui/Card';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageHeader, SectionHeader } from '../../../shared/ui/PageHeader';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { StatCard } from '../../../shared/ui/StatCard';
import { useAchievements } from '../hooks/useInsights';
import type { Achievement, Achievements } from '../types';

/** How far into the current level the points are, in percent (a level is a fixed number of points). */
const levelProgress = ({ total_points: points, current_level: level, next_level_points: next }: Achievements): number => {
  const perLevel = next / (level + 1);
  if (!perLevel) return 0;
  return Math.min(100, Math.max(0, ((points - perLevel * level) / perLevel) * 100));
};

const BadgeCard = ({ achievement }: { achievement: Achievement }) => {
  const { earned } = achievement;
  return (
    <Card
      as="li"
      className={cn('flex flex-col p-5', earned ? 'border-success-fg/30' : 'bg-surface-muted/30')}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl',
            earned ? 'bg-success-soft' : 'bg-surface-muted grayscale'
          )}
          aria-hidden="true"
        >
          {achievement.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn('font-semibold', earned ? 'text-fg' : 'text-fg-muted')}>{achievement.title}</h3>
            {earned ? (
              <CheckCircle2 size={18} aria-hidden="true" className="shrink-0 text-success-fg" />
            ) : (
              <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
            )}
          </div>
          {earned && (
            <p className="mt-0.5 text-xs font-medium text-success-fg">
              Earned{achievement.date ? ` ${formatDate(achievement.date)}` : ''}
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm text-fg-muted">{achievement.description}</p>

      {!earned && (
        <div className="mt-auto pt-4">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-fg-subtle">Progress</span>
            <span className="font-medium text-fg tabular-nums">{Math.round(achievement.progress)}%</span>
          </div>
          <ProgressBar value={achievement.progress} size="sm" label={`Progress towards ${achievement.title}`} />
        </div>
      )}
    </Card>
  );
};

const AchievementsPage = () => {
  const query = useAchievements();

  const header = <PageHeader title="Achievements" description="Points, levels and badges for the milestones of your learning." />;

  if (query.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <PageSpinner className="h-72" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <ErrorState
            title="Your achievements could not be loaded"
            error={query.error}
            onRetry={() => query.refetch()}
          />
        </Card>
      </div>
    );
  }

  const data = query.data;
  const toNext = Math.max(0, data.next_level_points - data.total_points);
  const earned = data.achievements.filter((achievement) => achievement.earned).length;

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Points" value={data.total_points} icon={Star} tone="warning"
          hint={`${earned} of ${data.achievements.length} badges earned`} />
        <StatCard label="Level" value={data.current_level} icon={Medal} tone="plus"
          hint={`a new level every ${Math.round(data.next_level_points / (data.current_level + 1))} points`} />
        <StatCard label="Points to next level" value={toNext} icon={Target} hint={`level ${data.current_level + 1} at ${data.next_level_points}`} />
        <StatCard label="Global rank" value={`#${data.global_rank}`} icon={Globe2} tone="info"
          hint={data.monthly_rank ? `#${data.monthly_rank} this month` : 'not ranked this month yet'} />
      </div>

      <Card padded className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-fg">
          <Sparkles size={26} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-lg font-semibold text-fg">Level {data.current_level}</p>
            <p className="text-sm text-fg-muted tabular-nums">
              {data.total_points} / {data.next_level_points} Points
            </p>
          </div>
          <ProgressBar value={levelProgress(data)} size="lg" label={`Progress to level ${data.current_level + 1}`} className="mt-3" />
          <p className="mt-2 text-xs text-fg-subtle">
            Lessons, passed quizzes and finished courses earn points. {toNext} more to reach level {data.current_level + 1}.
          </p>
        </div>
      </Card>

      <section>
        <SectionHeader
          title="Badges"
          description="Earned ones show the day you got them; the others show how close you are."
          action={<Badge tone="success" icon={CheckCircle2}>{`${earned} earned`}</Badge>}
        />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.achievements.map((achievement) => (
            <BadgeCard key={achievement.id} achievement={achievement} />
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AchievementsPage;
