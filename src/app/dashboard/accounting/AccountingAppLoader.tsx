'use client';

import dynamic from 'next/dynamic';

// This app's state is entirely localStorage-based (see lib/storage.ts),
// which doesn't exist during server rendering -- loading it client-only
// avoids a hydration mismatch between the server's empty render and the
// client's real stored data.
const AccountingApp = dynamic(() => import('./AccountingApp'), { ssr: false });

export default function AccountingAppLoader() {
  return <AccountingApp />;
}
