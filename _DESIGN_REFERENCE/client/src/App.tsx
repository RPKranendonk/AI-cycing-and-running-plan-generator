import { Switch, Route, useLocation } from "wouter";
import { AppProvider, useApp } from "@/lib/app-context";
import { Toaster } from "@/components/ui/toaster";
import { useEffect } from "react";

// Pages
import Dashboard from "@/pages/dashboard";
import Onboarding from "@/pages/onboarding";
import Schedule from "@/pages/schedule";
import Settings from "@/pages/settings";
import Layout from "@/components/layout";
import NotFound from "@/pages/not-found";

// Component to handle redirection if not authenticated
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useApp();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) {
      setLocation("/onboarding");
    }
  }, [user, setLocation]);

  if (!user) return null;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  const { user } = useApp();
  const [, setLocation] = useLocation();

  // Redirect authenticated users away from onboarding
  useEffect(() => {
    if (user && window.location.pathname === "/onboarding") {
      setLocation("/");
    }
  }, [user, setLocation]);

  return (
    <Switch>
      <Route path="/onboarding" component={Onboarding} />
      
      <Route path="/">
        {() => (
           user ? <Layout><Dashboard /></Layout> : <Onboarding />
        )}
      </Route>

      <Route path="/schedule">
        <ProtectedRoute component={Schedule} />
      </Route>

      <Route path="/progress">
         <Layout>
           <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
             Work in progress
           </div>
         </Layout>
      </Route>

      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AppProvider>
      <Router />
      <Toaster />
    </AppProvider>
  );
}

export default App;
