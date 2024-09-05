import { useContext } from 'react';
import { SealdContext } from '../contexts/SealdContext';

export const useSealdContext = () => useContext(SealdContext);
