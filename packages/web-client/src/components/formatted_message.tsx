import { shuffle } from '@eddo/core-client';
import { type FC } from 'react';

const SHUFFLE = false;

export const FormattedMessage: FC<{ message: string }> = ({ message }) => (
  <>{SHUFFLE ? shuffle(message) : message}</>
);
