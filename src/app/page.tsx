
import { Suspense } from "react";
import { HomePageContent } from "@/components/home-page-content";

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePageContent />
    </Suspense>
  )
}
