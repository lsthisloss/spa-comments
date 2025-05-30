import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/main.scss';
import { AppLoader } from './components/AppLoader';
import '@ant-design/v5-patch-for-react-19';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <AppLoader />
  </React.StrictMode>
);