import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSignUp } from '@clerk/expo';
import { AuthShell, Divider, Field, GoogleButton, clerkError } from '@/components/AuthShell';
import { Button, Notice } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function SignUp() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const c = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const busy = fetchStatus === 'fetching';

  const submit = async () => {
    setMessage('');
    const { error } = await signUp.password({ emailAddress: email.trim(), password });
    if (error) { setMessage(clerkError(error)); return; }
    const sent = await signUp.verifications.sendEmailCode();
    if (sent?.error) setMessage(clerkError(sent.error));
  };

  const verify = async () => {
    setMessage('');
    const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (error) { setMessage(clerkError(error)); return; }
    if (signUp.status === 'complete') {
      await signUp.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) return;
          router.replace('/home');
        },
      });
    } else setMessage('Your account needs more details before it can finish. Complete sign-up on the website.');
  };

  const verifying = signUp.status === 'missing_requirements' && signUp.unverifiedFields.includes('email_address') && signUp.missingFields.length === 0;

  if (verifying) {
    return (
      <AuthShell title="Verify your email" subtitle={`We sent a code to ${email || 'your email'}. It expires shortly.`} onBack={() => void signUp.reset()}>
        <Field label="Verification code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="6-digit code" error={errors.fields.code?.message} testID="input-sign-up-code" />
        {message ? <Notice text={message} /> : null}
        <Button label="Verify and continue" onPress={() => void verify()} busy={busy} disabled={!code.trim()} testID="button-sign-up-verify" />
        <Button label="Send a new code" variant="ghost" onPress={() => void signUp.verifications.sendEmailCode()} testID="button-sign-up-resend" />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="One account for the website and your phone.">
      <GoogleButton />
      <Divider label="or with email" />
      <View style={{ gap: 14 }}>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@school.edu" error={errors.fields.emailAddress?.message} testID="input-sign-up-email" />
        <Field label="Password" value={password} onChangeText={setPassword} secure autoComplete="new-password" textContentType="newPassword" placeholder="At least 8 characters" error={errors.fields.password?.message} testID="input-sign-up-password" />
      </View>
      {message ? <Notice text={message} testID="error-sign-up" /> : null}
      <Button label="Create account" icon="arrow-right" onPress={() => void submit()} busy={busy} disabled={!email.trim() || !password} testID="button-sign-up" />
      <View nativeID="clerk-captcha" />
      <Pressable onPress={() => router.replace('/sign-in')} accessibilityRole="link" style={{ alignItems: 'center', padding: 8 }} testID="link-sign-in">
        <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>Already have an account? <Text style={{ color: c.primary, fontFamily: 'Inter_600SemiBold' }}>Sign in</Text></Text>
      </Pressable>
    </AuthShell>
  );
}
