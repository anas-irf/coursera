import React, { useState } from 'react';
import { Search, Filter } from 'lucide-react';

import { useDebouncedValue } from '../../../shared/lib/useDebouncedValue';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import CourseCard from '../components/CourseCard';
import { useCatalog } from '../hooks/useLearning';

const DEFAULT_FILTERS = {
  category: 'all',
  level: 'all',
  type: 'all',
  search: '',
  sort: 'popular'
};

const ExplorePage = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  // the text is typed into the box at once, the request is sent when the typing pauses
  const search = useDebouncedValue(filters.search, 300);
  const catalog = useCatalog({ ...filters, search });
  const { courses, total } = catalog;

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (catalog.isPending) {
    return <PageSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Explore Courses</h1>
        <p className="text-gray-600">Discover new skills and advance your career</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search for courses, instructors, or topics..."
          aria-label="Search courses"
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          {/* Category Filter */}
          <select
            aria-label="Category"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="programming">Programming</option>
            <option value="web-development">Web Development</option>
            <option value="data-science">Data Science</option>
            <option value="design">Design</option>
            <option value="marketing">Marketing</option>
            <option value="business">Business</option>
          </select>

          {/* Level Filter */}
          <select
            aria-label="Level"
            value={filters.level}
            onChange={(e) => handleFilterChange('level', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          {/* Course Type Filter */}
          <select
            aria-label="Course type"
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="free">Free Courses</option>
            <option value="coursera_plus">Coursera Plus</option>
          </select>

          {/* Sort Filter */}
          <select
            aria-label="Sort by"
            value={filters.sort}
            onChange={(e) => handleFilterChange('sort', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {catalog.isError && courses.length === 0 ? (
        <ErrorState
          title="We could not load the courses"
          error={catalog.error}
          onRetry={() => catalog.refetch()}
        />
      ) : (
        <>
          {/* Results Count */}
          <div className="flex justify-between items-center">
            <p className="text-gray-600">
              {total} course{total !== 1 ? 's' : ''} found
            </p>
          </div>

          {/* Course Grid */}
          {courses.length > 0 ? (
            <div
              className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity ${
                catalog.isPlaceholderData ? 'opacity-60' : ''
              }`}
            >
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Search} title="No courses found">
              Try adjusting your search criteria or filters.
            </EmptyState>
          )}

          {/* More */}
          {catalog.hasNextPage && (
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-3">
                Showing {courses.length} of {total}
              </p>
              <button
                onClick={() => catalog.fetchNextPage()}
                disabled={catalog.isFetchingNextPage}
                className="px-6 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                {catalog.isFetchingNextPage ? 'Loading...' : 'Load more courses'}
              </button>
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
