/**
 * Custom Flowbite theme to use neutral-* colors instead of gray-*
 * This ensures dark mode consistency across the app.
 */

export const customFlowbiteTheme = {
  textInput: {
    field: {
      input: {
        colors: {
          gray: 'border-neutral-300 bg-neutral-50 text-neutral-900 focus:border-primary-500 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:placeholder-neutral-400 dark:focus:border-primary-500 dark:focus:ring-primary-500',
        },
      },
    },
  },
  textarea: {
    colors: {
      gray: 'border-neutral-300 bg-neutral-50 text-neutral-900 focus:border-primary-500 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:placeholder-neutral-400 dark:focus:border-primary-500 dark:focus:ring-primary-500',
    },
  },
  card: {
    root: {
      base: 'flex rounded-lg border border-neutral-200 bg-white shadow-md dark:border-neutral-700 dark:bg-neutral-800',
    },
  },
  checkbox: {
    base: 'h-4 w-4 rounded border border-neutral-300 bg-neutral-100 focus:ring-2 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-700 dark:ring-offset-neutral-800 dark:focus:ring-primary-600',
  },
  label: {
    root: {
      colors: {
        default: 'text-neutral-900 dark:text-white',
      },
    },
  },
  button: {
    color: {
      gray: 'border border-neutral-200 bg-white text-neutral-900 focus:ring-4 focus:ring-primary-300 enabled:hover:bg-neutral-100 enabled:hover:text-primary-700 dark:border-neutral-600 dark:bg-transparent dark:text-neutral-400 dark:enabled:hover:bg-neutral-700 dark:enabled:hover:text-white',
    },
  },
  spinner: {
    color: {
      info: 'fill-primary-600',
    },
  },
};
