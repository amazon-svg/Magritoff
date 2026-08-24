import { Outlet } from "react-router";
import { Header } from "@/app/layouts/Header";
import { UnauthBanner } from "@/app/layouts/UnauthBanner";

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