import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { stopAppStoreListener, useAppStore } from "./store/appStore";

export default function App() {
  const initialize = useAppStore((state) => state.initialize);

  useEffect(() => {
    void initialize();

    return () => {
      stopAppStoreListener();
    };
  }, [initialize]);

  return <RouterProvider router={router} />;
}
