import { type FC } from 'react';

import { shuffle } from '../utils/shuffle';

const SHUFFLE = false;

export const FormattedMessage: FC<{ message: string }> = ({ message }) => (
  <>{SHUFFLE ? shuffle(message) : message}</>
);
