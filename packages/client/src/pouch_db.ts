import PouchDB from 'pouchdb-browser';
import { createContext, useContext } from 'react';

export const pouchDb = new PouchDB('todos');
export const PouchDbContext = createContext(pouchDb);

export const usePouchDb = () => {
  return useContext(PouchDbContext);
};
