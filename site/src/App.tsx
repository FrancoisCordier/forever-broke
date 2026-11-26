import { lazy, Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router";
import { Layout } from "./components/Layout.tsx";
import { ToastProvider } from "./components/Toast.tsx";
import { BuyListPage } from "./pages/BuyListPage.tsx";
import { KitPage } from "./pages/KitPage.tsx";
import { RaidPrepPage } from "./pages/RaidPrepPage.tsx";

// The item page pulls in the charting library: load it only when opened.
const ItemPage = lazy(() => import("./pages/ItemPage.tsx").then((m) => ({ default: m.ItemPage })));

// Hash routing: GitHub Pages can't serve a single-page app's deep links (ADR-0008).
export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<BuyListPage />} />
            <Route path="/raid" element={<RaidPrepPage />} />
            <Route path="/kit" element={<KitPage />} />
            <Route
              path="/item/:id"
              element={
                <Suspense fallback={<p className="muted">Loading…</p>}>
                  <ItemPage />
                </Suspense>
              }
            />
            <Route path="*" element={<BuyListPage />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </HashRouter>
  );
}
