import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Loader2 } from "lucide-react";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Assistant from "./pages/Assistant";
import Analyze from "./pages/Analyze";
import Analytics from "./pages/Analytics";
import ContentGenerator from "./pages/ContentGenerator";
import Carousel from "./pages/Carousel";
import Plan from "./pages/Plan";
import Settings from "./pages/Settings";
import Trends from "./pages/Trends";
import Integrations from "./pages/Integrations";
import Voice from "./pages/Voice";
import Pricing from "./pages/Pricing";
import Admin from "./pages/Admin";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { PersonalDataConsent, Terms, Privacy } from "./pages/Legal";
import Landing from "./pages/Landing";
import Navigation from "./components/Navigation";
import Sidebar from "./components/Sidebar";
import VerifyEmailBanner from "./components/VerifyEmailBanner";
import OnboardingTour from "./components/OnboardingTour";

const PUBLIC_PATHS = [
  "/",
  "/signin",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/legal/personal-data",
  "/legal/terms",
  "/legal/privacy",
];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

/* Защита: пока ждём auth.me — спиннер; не залогинен на защищённом
   маршруте → редирект на /signin; залогинен на /signin → редирект на /. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const [location, navigate] = useLocation();
  const publicRoute = isPublic(location);

  useEffect(() => {
    if (!ready) return;
    if (!user && !publicRoute) {
      navigate("/signin");
    } else if (user && (location === "/signin" || location === "/signup")) {
      navigate("/dashboard");
    }
  }, [ready, user, publicRoute, location, navigate]);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background)",
          color: "var(--brand-platinum)",
        }}
      >
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}

/* "/" — лендинг для всех (и гостей, и залогиненных, и админа).
   Дашборд («Идеи») живёт на /dashboard. Раньше "/" условно
   показывал Dashboard залогиненным — теперь главная едина для всех,
   так юзер всегда видит «витрину продукта». */
function Router() {
  return (
    <Switch>
      <Route path="/signin" component={SignIn} />
      <Route path="/signup" component={SignUp} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/legal/personal-data" component={PersonalDataConsent} />
      <Route path="/legal/terms" component={Terms} />
      <Route path="/legal/privacy" component={Privacy} />
      <Route path={"/"} component={Landing} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/assistant" component={Assistant} />
      <Route path="/analyze" component={Analyze} />
      <Route path="/generator" component={ContentGenerator} />
      <Route path="/carousel" component={Carousel} />
      <Route path="/voice" component={Voice} />
      <Route path="/trends" component={Trends} />
      <Route path="/plan" component={Plan} />
      <Route path="/library" component={Plan} />
      <Route path="/calendar" component={Plan} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/settings" component={Settings} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/admin" component={Admin} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Shell() {
  const [location] = useLocation();
  const { user } = useAuth();
  /* На auth-страницах и лендинге своя разметка — без основной
     навигации. Лендинг ("/") теперь общий для всех, у него
     собственная адаптивная шапка (LandingNav). */
  const hideNav =
    location === "/" ||
    location === "/signin" ||
    location === "/signup" ||
    location === "/verify-email" ||
    location === "/forgot-password" ||
    location === "/reset-password";

  if (hideNav) {
    return (
      <>
        <Router />
        {user && <OnboardingTour />}
      </>
    );
  }

  /* Layout с sidebar (desktop) + main. На mobile sidebar скрыт через
     CSS, вместо него рендерится горизонтальный Navigation сверху. */
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="cs-mobile-nav">
          <Navigation />
        </div>
        <VerifyEmailBanner />
        <Router />
      </main>
      {user && <OnboardingTour />}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <WorkspaceProvider>
            <TooltipProvider>
              <Toaster />
              <AuthGate>
                <Shell />
              </AuthGate>
            </TooltipProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
