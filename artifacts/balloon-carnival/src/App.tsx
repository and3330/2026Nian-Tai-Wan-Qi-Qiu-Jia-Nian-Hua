import { lazy, Suspense, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trackPageView } from "@/lib/fbPixel";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@workspace/replit-auth-web";
import { LanguageProvider, useI18n } from "@/lib/i18n";
import { DocumentMeta } from "@/components/DocumentMeta";
import { RouteA11y } from "@/components/RouteA11y";
import { MotionConfig } from "framer-motion";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";

// Pages
import HomePage from "@/pages/HomePage";
const NewsPage = lazy(() => import("@/pages/NewsPage"));
const NewsDetailPage = lazy(() => import("@/pages/NewsDetailPage"));
const ContestantsPage = lazy(() => import("@/pages/ContestantsPage"));
const CarnivalPage = lazy(() => import("@/pages/CarnivalPage"));
const TORPage = lazy(() => import("@/pages/TORPage"));
const SponsorsPage = lazy(() => import("@/pages/SponsorsPage"));
const AdGuidePage = lazy(() => import("@/pages/AdGuidePage"));
const PaymentResultPage = lazy(() => import("@/pages/PaymentResultPage"));
const OrderLookupPage = lazy(() => import("@/pages/OrderLookupPage"));
const RefundInfoPage = lazy(() => import("@/pages/RefundInfoPage"));
const AccessibilityPage = lazy(() => import("@/pages/AccessibilityPage"));

// Admin Pages
const AdminLayout = lazy(() => import("@/pages/AdminLayout"));
const AdminLoginPage = lazy(() => import("@/pages/AdminLoginPage"));
const AdminDashboard = lazy(() => import("@/pages/Admin/Dashboard"));
const AdminOrdersManage = lazy(() => import("@/pages/Admin/OrdersManage"));
const AdminInvoicesManage = lazy(() => import("@/pages/Admin/InvoicesManage"));
const AdminTournamentManage = lazy(() => import("@/pages/Admin/TournamentManage"));
const AdminNewsManage = lazy(() => import("@/pages/Admin/NewsManage"));
const AdminContestantsManage = lazy(() => import("@/pages/Admin/ContestantsManage"));
const AdminSponsorsManage = lazy(() => import("@/pages/Admin/SponsorsManage"));
const AdminSocialAccounts = lazy(() => import("@/pages/Admin/SocialAccountsManage"));
const AdminSocialPosts = lazy(() => import("@/pages/Admin/SocialPostsManage"));
const AdminAutomation = lazy(() => import("@/pages/Admin/AutomationSettings"));
const AdminCheckin = lazy(() => import("@/pages/Admin/CheckinPage"));
const AdminPOS = lazy(() => import("@/pages/Admin/POSPage"));
const AdminEmailTemplates = lazy(() => import("@/pages/Admin/EmailTemplatesPage"));
const AdminUsersManage = lazy(() => import("@/pages/Admin/UsersManage"));
const AdminPromoCodesManage = lazy(() => import("@/pages/Admin/PromoCodesManage"));
const AdminRefundRequestsManage = lazy(() => import("@/pages/Admin/RefundRequestsManage"));
const AdminVendorsManage = lazy(() => import("@/pages/Admin/VendorsManage"));

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
  const { lang } = useI18n();
  return (
    <>
    {/* Must live OUTSIDE <Layout>: Layout wraps children in a motion.div keyed
        by location, which would remount this on every navigation. */}
    <RouteA11y />
    <Layout>
      <PixelPageViewTracker />
      <Suspense fallback={<div role="status" aria-live="polite" className="min-h-[50vh] flex items-center justify-center p-8">{lang === "en" ? "Loading page…" : "頁面載入中…"}</div>}>
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
        <Route path="/refund-info/:token" component={RefundInfoPage} />
        <Route path="/accessibility" component={AccessibilityPage} />

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
        <Route path="/admin/pos">
          {() => <AdminLayout><AdminPOS /></AdminLayout>}
        </Route>
        <Route path="/admin/vendors">
          {() => <AdminLayout><AdminVendorsManage /></AdminLayout>}
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
      </Suspense>
    </Layout>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Render-prop: a language change re-renders (never remounts) the tree,
            so in-progress form input, carts and selections are preserved. */}
        <LanguageProvider>
          {() => (
            <MotionConfig reducedMotion="user">
            <TooltipProvider>
              <DocumentMeta />
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
            </MotionConfig>
          )}
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
