import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trackPageView } from "@/lib/fbPixel";
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
import TORPage from "@/pages/TORPage";
import SponsorsPage from "@/pages/SponsorsPage";
import AdGuidePage from "@/pages/AdGuidePage";
import PaymentResultPage from "@/pages/PaymentResultPage";
import OrderLookupPage from "@/pages/OrderLookupPage";

// Admin Pages
import AdminLayout from "@/pages/AdminLayout";
import AdminLoginPage from "@/pages/AdminLoginPage";
import AdminDashboard from "@/pages/Admin/Dashboard";
import AdminOrdersManage from "@/pages/Admin/OrdersManage";
import AdminInvoicesManage from "@/pages/Admin/InvoicesManage";
import AdminTournamentManage from "@/pages/Admin/TournamentManage";
import AdminNewsManage from "@/pages/Admin/NewsManage";
import AdminContestantsManage from "@/pages/Admin/ContestantsManage";
import AdminSponsorsManage from "@/pages/Admin/SponsorsManage";
import AdminSocialAccounts from "@/pages/Admin/SocialAccountsManage";
import AdminSocialPosts from "@/pages/Admin/SocialPostsManage";
import AdminAutomation from "@/pages/Admin/AutomationSettings";
import AdminCheckin from "@/pages/Admin/CheckinPage";
import AdminEmailTemplates from "@/pages/Admin/EmailTemplatesPage";
import AdminUsersManage from "@/pages/Admin/UsersManage";
import AdminPromoCodesManage from "@/pages/Admin/PromoCodesManage";
import AdminRefundRequestsManage from "@/pages/Admin/RefundRequestsManage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PixelPageViewTracker() {
  const [location] = useLocation();
  // initPixel() already fires the first PageView on load, so skip the
  // initial mount and only track subsequent client-side route changes.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    trackPageView();
  }, [location]);
  return null;
}

function Router() {
  return (
    <Layout>
      <PixelPageViewTracker />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/news" component={NewsPage} />
        <Route path="/news/:id" component={NewsDetailPage} />
        <Route path="/carnival" component={CarnivalPage} />
        <Route path="/TOR" component={TORPage} />
        <Route path="/tor" component={TORPage} />
        <Route path="/contestants" component={ContestantsPage} />
        <Route path="/conference">{() => <Redirect to="/contestants" />}</Route>
        <Route path="/sponsors" component={SponsorsPage} />
        <Route path="/ad-guide" component={AdGuidePage} />
        <Route path="/payment/result" component={PaymentResultPage} />
        <Route path="/lookup" component={OrderLookupPage} />

        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/admin">
          {() => <AdminLayout><AdminDashboard /></AdminLayout>}
        </Route>
        <Route path="/admin/orders">
          {() => <AdminLayout><AdminOrdersManage /></AdminLayout>}
        </Route>
        <Route path="/admin/invoices">
          {() => <AdminLayout><AdminInvoicesManage /></AdminLayout>}
        </Route>
        <Route path="/admin/tournament">
          {() => <AdminLayout><AdminTournamentManage /></AdminLayout>}
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
        <Route path="/admin/checkin">
          {() => <AdminLayout><AdminCheckin /></AdminLayout>}
        </Route>
        <Route path="/admin/email-templates">
          {() => <AdminLayout><AdminEmailTemplates /></AdminLayout>}
        </Route>
        <Route path="/admin/promo-codes">
          {() => <AdminLayout><AdminPromoCodesManage /></AdminLayout>}
        </Route>
        <Route path="/admin/refund-requests">
          {() => <AdminLayout><AdminRefundRequestsManage /></AdminLayout>}
        </Route>
        <Route path="/admin/users">
          {() => <AdminLayout><AdminUsersManage /></AdminLayout>}
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
