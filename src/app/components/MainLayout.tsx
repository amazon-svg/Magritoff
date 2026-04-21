import { Outlet } from "react-router";
import { Header } from "./Header";
import { UnauthBanner } from "./UnauthBanner";

export function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main>
        <Outlet />
      </main>
      <UnauthBanner />
    </div>
  );
}