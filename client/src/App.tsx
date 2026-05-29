import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import ContentGenerator from "./pages/ContentGenerator";
import Plan from "./pages/Plan";
import Settings from "./pages/Settings";
import Trends from "./pages/Trends";
import Media from "./pages/Media";
import Integrations from "./pages/Integrations";
import Navigation from "./components/Navigation";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path="/generator" component={ContentGenerator} />
      <Route path="/trends" component={Trends} />
      <Route path="/media" component={Media} />
      {/* /plan — основной маршрут (табы Календарь / Архив).
          /calendar и /library оставлены для обратной совместимости со
          старыми закладками — оба ведут в Plan, начальный таб
          определяется внутри по pathname. */}
      <Route path="/plan" component={Plan} />
      <Route path="/library" component={Plan} />
      <Route path="/calendar" component={Plan} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/settings" component={Settings} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <WorkspaceProvider>
          <TooltipProvider>
            <Toaster />
            <Navigation />
            <Router />
          </TooltipProvider>
        </WorkspaceProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
