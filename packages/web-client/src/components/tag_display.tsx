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
          className={`bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300 inline-flex items-center rounded-full font-medium ${sizeClasses[size]}`}
          key={tag}
        >
          {tag}
        </span>
      ))}
      {remainingCount > 0 && (
        <span
          className={`inline-flex items-center rounded-full bg-neutral-100 font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300 ${sizeClasses[size]}`}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
};
