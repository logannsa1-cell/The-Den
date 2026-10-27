import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSignIn } from '@clerk/expo';
import { AuthShell, Divider, Field, GoogleButton, clerkError } from '@/components/AuthShell';
import { Button, Notice } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function SignIn() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const c = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const busy = fetchStatus === 'fetching';

  const finish = async () => {
    await signIn.finalize({
      navigate: ({ session }) => {
        if (session?.currentTask) return;
        router.replace('/home');
      },
    });
  };

  const submit = async () => {
    setMessage('');
    const { error } = await signIn.password({ emailAddress: email.trim(), password });
    if (error) { setMessage(clerkError(error)); return; }
    if (signIn.status === 'complete') await finish();
    else if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
      const emailFactor = signIn.supportedSecondFactors.find((f) => f.strategy === 'email_code');
      if (emailFactor) await signIn.mfa.sendEmailCode();
      else setMessage('This account needs a second step that the app does not support yet. Sign in on the website.');
    } else setMessage('Sign-in is not complete. Check your details and try again.');
  };

  const verify = async () => {
    setMessage('');
    const { error } = await signIn.mfa.verifyEmailCode({ code: code.trim() });
    if (error) { setMessage(clerkError(error)); return; }
    if (signIn.status === 'complete') await finish();
    else setMessage('That code did not finish sign-in. Request a new one.');
  };

  if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
    return (
      <AuthShell title="Check your email" subtitle={`Enter the code sent to ${email || 'your email'}.`} onBack={() => void signIn.reset()}>
        <Field label="Verification code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="6-digit code" error={errors.fields.code?.message} testID="input-sign-in-code" />
        {message ? <Notice text={message} /> : null}
        <Button label="Verify" onPress={() => void verify()} busy={busy} disabled={!code.trim()} testID="button-sign-in-verify" />
        <Button label="Send a new code" variant="ghost" onPress={() => void signIn.mfa.sendEmailCode()} testID="button-sign-in-resend" />
        <Button label="Start over" variant="ghost" onPress={() => void signIn.reset()} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in with the same account you use on the Jaguar website.">
      <GoogleButton />
      <Divider label="or with email" />
      <View style={{ gap: 14 }}>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@school.edu" error={errors.fields.identifier?.message} testID="input-sign-in-email" />
        <Field label="Password" value={password} onChangeText={setPassword} secure autoComplete="password" textContentType="password" placeholder="Your password" error={errors.fields.password?.message} testID="input-sign-in-password" onSubmitEditing={() => void submit()} />
        <Pressable onPress={() => router.push('/forgot-password')} accessibilityRole="link" hitSlop={8} testID="link-forgot">
          <Text style={{ color: c.primary, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Forgot password?</Text>
        </Pressable>
      </View>
      {message ? <Notice text={message} testID="error-sign-in" /> : null}
      <Button label="Sign in" icon="arrow-right" onPress={() => void submit()} busy={busy} disabled={!email.trim() || !password} testID="button-sign-in" />
      <Pressable onPress={() => router.replace('/sign-up')} accessibilityRole="link" style={{ alignItems: 'center', padding: 8 }} testID="link-sign-up">
        <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>New to Jaguar? <Text style={{ color: c.primary, fontFamily: 'Inter_600SemiBold' }}>Create an account</Text></Text>
      </Pressable>
    </AuthShell>
  );
}
