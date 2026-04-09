import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@workspace/replit-auth-web";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";

// Pages
import HomePage from "@/pages/HomePage";
import NewsPage from "@/pages/NewsPage";
import NewsDetailPage from "@/pages/NewsDetailPage";
import ContestantsPage from "@/pages/ContestantsPage";
import CarnivalPage from "@/pages/CarnivalPage";
import SponsorsPage from "@/pages/SponsorsPage";

// Admin Pages
import AdminLayout from "@/pages/AdminLayout";
import AdminLoginPage from "@/pages/AdminLoginPage";
import AdminDashboard from "@/pages/Admin/Dashboard";
import AdminNewsManage from "@/pages/Admin/NewsManage";
import AdminContestantsManage from "@/pages/Admin/ContestantsManage";
import AdminSponsorsManage from "@/pages/Admin/SponsorsManage";
import AdminSocialAccounts from "@/pages/Admin/SocialAccountsManage";
import AdminSocialPosts from "@/pages/Admin/SocialPostsManage";
import AdminAutomation from "@/pages/Admin/AutomationSettings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/news" component={NewsPage} />
        <Route path="/news/:id" component={NewsDetailPage} />
        <Route path="/carnival" component={CarnivalPage} />
        <Route path="/conference" component={ContestantsPage} />
        <Route path="/sponsors" component={SponsorsPage} />

        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/admin">
          {() => <AdminLayout><AdminDashboard /></AdminLayout>}
        </Route>
        <Route path="/admin/news">
          {() => <AdminLayout><AdminNewsManage /></AdminLayout>}
        </Route>
        <Route path="/admin/contestants">
          {() => <AdminLayout><AdminContestantsManage /></AdminLayout>}
        </Route>
        <Route path="/admin/sponsors">
          {() => <AdminLayout><AdminSponsorsManage /></AdminLayout>}
        </Route>
        <Route path="/admin/social-accounts">
          {() => <AdminLayout><AdminSocialAccounts /></AdminLayout>}
        </Route>
        <Route path="/admin/social-posts">
          {() => <AdminLayout><AdminSocialPosts /></AdminLayout>}
        </Route>
        <Route path="/admin/automation">
          {() => <AdminLayout><AdminAutomation /></AdminLayout>}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
