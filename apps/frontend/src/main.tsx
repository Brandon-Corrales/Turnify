import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { queryClient } from '@/lib/queryClient';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* reducedMotion="user": las animaciones de Framer Motion respetan
        prefers-reduced-motion del SO (punto 6 del brief). La regla CSS de
        index.css cubre transiciones/animaciones puramente CSS; esto cubre
        las que Motion anima por JS (whileHover, whileTap, layout, etc). */}
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </MotionConfig>
  </StrictMode>,
);
