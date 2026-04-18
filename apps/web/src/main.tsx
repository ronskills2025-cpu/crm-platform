import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)]',
          style: { 
            background: 'var(--bg-elevated)', 
            color: 'var(--text-primary)', 
            border: '1px solid var(--border-default)',
            borderRadius: '12px'
          },
          success: { 
            iconTheme: { primary: 'var(--status-success)', secondary: 'var(--text-primary)' },
            style: { border: '1px solid var(--status-success-border)' }
          },
          error: { 
            iconTheme: { primary: 'var(--status-error)', secondary: 'var(--text-primary)' },
            style: { border: '1px solid var(--status-error-border)' }
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
);
