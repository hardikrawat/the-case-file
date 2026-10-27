import { createContext, useContext } from 'react';

export const IsReadOnlyContext = createContext<boolean>(false);

export const useIsReadOnly = () => useContext(IsReadOnlyContext);
