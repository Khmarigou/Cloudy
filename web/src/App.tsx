import { useState } from "react";
import { getStoredUser } from "./api/client";
import type { SimpleUser } from "./api/types";
import { LibraryPage } from "./pages/LibraryPage";
import { LoginPage } from "./pages/LoginPage";

export default function App() {
  const [user, setUser] = useState<SimpleUser | null>(getStoredUser);

  if (!user) {
    return <LoginPage onSignedIn={(auth) => setUser(auth.user)} />;
  }

  return <LibraryPage user={user} onSignOut={() => setUser(null)} />;
}
