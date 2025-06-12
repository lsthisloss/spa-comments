import { createContext } from 'react';
import { stores, type Stores } from '../services/stores/stores';

// Только создание контекста, без компонентов
export const StoresContext = createContext<Stores>(stores);