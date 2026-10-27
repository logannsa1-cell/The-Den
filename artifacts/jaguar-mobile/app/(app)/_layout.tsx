import React, { useEffect, useRef } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { WorkspaceProvider } from '@/lib/workspace';
import { useColors } from '@/hooks/useColors';

export default function AppLayout() {
  const { isSignedIn, getToken, userId } = useAuth();
  const qc = useQueryClient();
  const c = useColors();
  const lastUser = useRef<string | null | undefined>(undefined);
  const getTokenRef = useRef(getToken); getTokenRef.current = getToken;

  useEffect(() => {
    setAuthTokenGetter(() => getTokenRef.current());
    return () => setAuthTokenGetter(null);
  }, []);

  // Identity change (sign-out or a different account): cancel in-flight requests and drop every cached response.
  useEffect(() => {
    if (lastUser.current !== undefined && lastUser.current !== userId) {
      void qc.cancelQueries();
      qc.clear();
    }
    lastUser.current = userId;
  }, [userId, qc]);

  if (!isSignedIn || !userId) return <Redirect href="/" />;
  return (
    <WorkspaceProvider key={userId} userId={userId}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
        <Stack.Screen name="home" />
        <Stack.Screen name="study/[id]" />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </WorkspaceProvider>
  );
}
