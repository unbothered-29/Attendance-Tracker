/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { Login } from './views/Login';
import { Setup } from './views/Setup';
import { Dashboard } from './views/Dashboard';

function AppContent() {
  const { state } = useAppContext();

  if (!state.user) {
    return <Login />;
  }

  if (!state.isSetupComplete) {
    return <Setup />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-[#0a050f] text-gray-200 selection:bg-purple-500/30">
        <AppContent />
      </div>
    </AppProvider>
  );
}
