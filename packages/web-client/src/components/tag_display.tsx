import { type FC } from 'react';

interface TagDisplayProps {
  tags: string[];
  size?: 'sm' | 'xs';
  maxTags?: number;
}

export const TagDisplay: FC<TagDisplayProps> = ({ tags, size = 'xs', maxTags }) => {
  if (tags.length === 0) return null;

  const displayTags = maxTags ? tags.slice(0, maxTags) : tags;
  const remainingCount = maxTags && tags.length > maxTags ? tags.length - maxTags : 0;

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-1 text-sm',
  };

  return (
    <div className="flex flex-wrap gap-1">
      {displayTags.map((tag) => (
        <span
          className={`inline-flex items-center rounded-full bg-blue-100 font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300 ${sizeClasses[size]}`}
          key={tag}
        >
          {tag}
        </span>
      ))}
      {remainingCount > 0 && (
        <span
          className={`inline-flex items-center rounded-full bg-gray-100 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300 ${sizeClasses[size]}`}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
};
