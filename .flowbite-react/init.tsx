import type { FC } from 'react';

export const ThemeInit: FC = () => {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if (true) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        `,
      }}
    />
  );
};