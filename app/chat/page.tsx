import { Suspense } from "react";
import ChatClient from "./chatclient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChatClient />
    </Suspense>
  );
}