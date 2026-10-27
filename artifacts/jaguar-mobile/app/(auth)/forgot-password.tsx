import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSignIn } from '@clerk/expo';
import { AuthShell, Field, clerkError } from '@/components/AuthShell';
import { Button, Notice } from '@/components/ui';

type Step = 'email' | 'code' | 'password';

export default function ForgotPassword() {
  const { signIn, fetchStatus } = useSignIn();
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const busy = fetchStatus === 'fetching';

  const sendCode = async () => {
    setMessage('');
    const created = await signIn.create({ identifier: email.trim() });
    if (created.error) { setMessage(clerkError(created.error)); return; }
    const sent = await signIn.resetPasswordEmailCode.sendCode();
    if (sent.error) { setMessage(clerkError(sent.error)); return; }
    setStep('code');
  };

  const verifyCode = async () => {
    setMessage('');
    const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
    if (error) { setMessage(clerkError(error)); return; }
    setStep('password');
  };

  const submitPassword = async () => {
    setMessage('');
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({ password });
    if (error) { setMessage(clerkError(error)); return; }
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: ({ session }) => { if (session?.currentTask) return; router.replace('/home'); } });
    } else setMessage('Password changed. Sign in with your new password.');
  };

  return (
    <AuthShell
      title={step === 'email' ? 'Reset your password' : step === 'code' ? 'Enter the code' : 'Choose a new password'}
      subtitle={step === 'email' ? 'We will email you a reset code.' : step === 'code' ? `Sent to ${email}.` : 'Use something you have not used before.'}
    >
      {step === 'email' && <>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@school.edu" testID="input-reset-email" />
        {message ? <Notice text={message} /> : null}
        <Button label="Send reset code" onPress={() => void sendCode()} busy={busy} disabled={!email.trim()} testID="button-reset-send" />
      </>}
      {step === 'code' && <>
        <Field label="Reset code" value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" placeholder="6-digit code" testID="input-reset-code" />
        {message ? <Notice text={message} /> : null}
        <Button label="Verify code" onPress={() => void verifyCode()} busy={busy} disabled={!code.trim()} testID="button-reset-verify" />
        <Button label="Send a new code" variant="ghost" onPress={() => void signIn.resetPasswordEmailCode.sendCode()} />
      </>}
      {step === 'password' && <>
        <Field label="New password" value={password} onChangeText={setPassword} secure autoComplete="new-password" textContentType="newPassword" placeholder="At least 8 characters" testID="input-reset-password" />
        {message ? <Notice text={message} tone={message.startsWith('Password changed') ? 'good' : 'error'} /> : null}
        <Button label="Save password" onPress={() => void submitPassword()} busy={busy} disabled={password.length < 8} testID="button-reset-save" />
      </>}
    </AuthShell>
  );
}
