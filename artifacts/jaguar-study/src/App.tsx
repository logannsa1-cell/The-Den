import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import Workspace from '@/pages/Workspace';
import LandingPage from '@/pages/Landing';
import { BrandLockup, EMBLEM, RosetteCorners, ThemeSwitcher, basePath } from '@/components/Brand';
import { ThemeProvider, useTheme, type ThemeSpec } from '@/lib/theme';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/user-portal" /></Show><Show when="signed-out"><LandingPage /></Show></>;
}

function UserPortal() {
  const { user } = useUser();
  return <><Show when="signed-in"><Workspace key={user?.id} /></Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function AuthShell({ title, line, children }: { title: ReactNode; line: string; children: ReactNode }) {
  return (
    <div className="auth-page">
      <RosetteCorners />
      <div className="auth-aside">
        <div className="auth-top"><Link href="/" className="landing-brand" data-testid="link-auth-home"><BrandLockup size={38} /></Link><ThemeSwitcher compact /></div>
        <div><img src={EMBLEM} alt="" className="auth-emblem" /><h1>{title}</h1><p>{line}</p></div>
      </div>
      <div className="auth-card">{children}</div>
    </div>
  );
}

function SignInPage() {
  return <AuthShell title="Welcome back" line="Your sets are where you left them."><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl="/" /></AuthShell>;
}

function SignUpPage() {
  return <AuthShell title={<>Get ready for <em className="editorial-accent">exam day.</em></>} line="Make a space for your notes."><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl="/" /></AuthShell>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user: currentUser }) => {
      const nextUser = currentUser?.id ?? null;
      if (previousUser.current !== undefined && previousUser.current !== nextUser) client.clear();
      previousUser.current = nextUser;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function clerkAppearance(t: ThemeSpec) {
  return {
    theme: shadcn,
    cssLayerName: 'clerk',
    options: {
      logoPlacement: 'inside' as const,
      logoLinkUrl: basePath || '/',
      logoImageUrl: `${window.location.origin}${EMBLEM}`,
      socialButtonsPlacement: 'top' as const,
      socialButtonsVariant: 'blockButton' as const,
    },
    variables: {
      colorPrimary: t.accent, colorPrimaryForeground: t.accentInk, colorForeground: t.text, colorMutedForeground: t.muted,
      colorDanger: '#f08a8a', colorBackground: t.surface, colorInput: t.bg, colorInputForeground: t.text,
      colorNeutral: t.text, colorBorder: t.line, fontFamily: 'Geist, sans-serif', borderRadius: '0.75rem',
    },
    elements: {
      rootBox: 'w-full min-w-0 flex justify-center',
      cardBox: 'w-full max-w-[420px] min-w-0 overflow-hidden rounded-2xl shadow-2xl',
      card: '!shadow-none !border-0 !rounded-none w-full min-w-0 px-5 sm:px-8',
      footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
      logoBox: 'h-14 justify-center',
      logoImage: 'object-contain h-14 w-14 rounded-xl',
      formButtonPrimary: 'font-semibold',
      socialButtonsBlockButton: 'min-w-0',
      formFieldRow: 'gap-2 flex-wrap',
    },
  };
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  const { theme } = useTheme();
  const appearance = useMemo(() => clerkAppearance(theme), [theme]);
  const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={appearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      localization={{
        signIn: { start: { title: 'Sign in to Jaguar', subtitle: 'Pick up your study sets.' } },
        signUp: { start: { title: 'Join Jaguar', subtitle: 'Use your notes to study better.' } },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <RoutedErrorBoundary>
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/user-portal" component={UserPortal} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route component={NotFound} />
            </Switch>
          </RoutedErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return (
    <ThemeProvider>
      <WouterRouter base={basePath}>
        <ClerkRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
