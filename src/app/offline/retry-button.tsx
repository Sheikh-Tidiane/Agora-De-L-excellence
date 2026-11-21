"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Recharge la page demandée ; le fait aussi de lui-même dès que le navigateur retrouve le réseau. */
export function RetryButton() {
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, []);
  return (
    <Button
      variant="action"
      size="lg"
      className="max-sm:w-full"
      onClick={() => window.location.reload()}
    >
      Réessayer
    </Button>
  );
}
