import { Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '../lib/AuthContext';

/**
 * The only job of the index route is to send people to the right group once
 * the token check has finished. `_layout` holds the splash until then, so
 * `status` is never 'loading' by the time this renders.
 */
export default function Index() {
  const { status } = useAuth();
  return <Redirect href={status === 'signedIn' ? '/(app)/home' : '/(auth)/welcome'} />;
}
