'use client';

import dynamic from 'next/dynamic';

// This app's state is fetched per account from the server (see lib/storage.ts)
// once the page is in the browser, so it's rendered client-only to avoid a
// hydration mismatch between the server's empty render and the loaded data.
const AccountingApp = dynamic(() => import('./AccountingApp'), { ssr: false });

export default function AccountingAppLoader() {
  return <AccountingApp />;
}
