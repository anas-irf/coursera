import React, { useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';

import { BRAND } from '../../../shared/brand';
import { useDebouncedValue } from '../../../shared/lib/useDebouncedValue';
import { cn } from '../../../shared/lib/cn';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { Field } from '../../../shared/ui/Field';
import { SearchInput, Select } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Skeleton } from '../../../shared/ui/Skeleton';
import CourseCard from '../components/CourseCard';
import { useCatalog, useCategories } from '../hooks/useLearning';
import type { CatalogFilters } from '../types';

const DEFAULT_FILTERS: CatalogFilters = {
  category: 'all',
  level: 'all',
  type: 'all',
  search: '',
  sort: 'popular',
};

const isFiltered = (filters: CatalogFilters) =>
  (Object.keys(DEFAULT_FILTERS) as Array<keyof CatalogFilters>).some((key) => filters[key] !== DEFAULT_FILTERS[key]);

/** The shape of a card while the first page loads. */
const CardSkeleton = () => (
  <div className="overflow-hidden rounded-xl border border-line bg-surface">
    <Skeleton className="aspect-video w-full rounded-none" />
    <div className="space-y-3 p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-9 w-full" />
    </div>
  </div>
);

const ExplorePage = () => {
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  // the text is typed into the box at once, the request is sent when the typing pauses
  const search = useDebouncedValue(filters.search, 300);
  const catalog = useCatalog({ ...filters, search });
  const categories = useCategories();
  const { courses, total } = catalog;

  const set = (key: keyof CatalogFilters) => (value: string) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <PageHeader title="Explore Courses" description="Discover new skills, taught by instructors who practise them." />

      <Card className="p-4">
        <SearchInput
          label="Search courses"
          placeholder="Search for courses, instructors, or topics..."
          value={filters.search}
          onChange={set('search')}
        />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field label="Category">
            <Select value={filters.category} onChange={(event) => set('category')(event.target.value)}>
              <option value="all">All Categories</option>
              {(categories.data || []).map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Level">
            <Select value={filters.level} onChange={(event) => set('level')(event.target.value)}>
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </Field>
          <Field label="Course type">
            <Select value={filters.type} onChange={(event) => set('type')(event.target.value)}>
              <option value="all">All Types</option>
              <option value="free">Free Courses</option>
              <option value="coursera_plus">{BRAND.plus}</option>
            </Select>
          </Field>
          <Field label="Sort by">
            <Select value={filters.sort} onChange={(event) => set('sort')(event.target.value)}>
              <option value="popular">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="newest">Newest</option>
            </Select>
          </Field>
        </div>
      </Card>

      {catalog.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading courses" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : catalog.isError && courses.length === 0 ? (
        <ErrorState title="We could not load the courses" error={catalog.error} onRetry={() => catalog.refetch()} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-fg-muted" aria-live="polite">
              {total} course{total !== 1 ? 's' : ''} found
            </p>
            {isFiltered(filters) && (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear filters
              </Button>
            )}
          </div>

          {courses.length > 0 ? (
            <div
              className={cn(
                'grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3',
                catalog.isPlaceholderData && 'opacity-60'
              )}
            >
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Search} title="No courses found" className="rounded-xl border border-dashed border-line-strong py-14">
              Try adjusting your search criteria or filters.
            </EmptyState>
          )}

          {catalog.hasNextPage && (
            <div className="flex flex-col items-center gap-3 pt-2">
              <p className="text-sm text-fg-subtle">
                Showing {courses.length} of {total}
              </p>
              <Button variant="secondary" onClick={() => catalog.fetchNextPage()} loading={catalog.isFetchingNextPage}>
                {catalog.isFetchingNextPage ? 'Loading...' : 'Load more courses'}
              </Button>
            </div>
          )}
          {catalog.isFetchNextPageError && (
            <ErrorState
              className="py-4"
              title="We could not load more courses"
              error={catalog.error}
              onRetry={() => catalog.fetchNextPage()}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ExplorePage;
