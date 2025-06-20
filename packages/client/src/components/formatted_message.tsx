import { type FC } from 'react';

import { shuffle } from '@eddo/shared';

const SHUFFLE = false;

export const FormattedMessage: FC<{ message: string }> = ({ message }) => (
  <>{SHUFFLE ? shuffle(message) : message}</>
);
