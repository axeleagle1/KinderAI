import { Suspense } from "react";
import ChatClient from "./chatclient";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  // ✅ Fix for your build error: useSearchParams must be behind Suspense (and avoid prerender)
  return (
    <Suspense fallback={null}>
      <ChatClient />
    </Suspense>
  );
}