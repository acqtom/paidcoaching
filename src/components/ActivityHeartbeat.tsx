"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const INTERVAL_SECONDS = 20;

// Mounted once, portal-wide, for every logged-in user (see
// src/app/dashboard/layout.tsx). Every INTERVAL_SECONDS, while this tab
// is actually visible, credits that many seconds to today's row in
// activity_daily -- powers the "average time spent per day" card on
// Student Data. "Today" is this browser's own local calendar day, same
// fix as Today's Cash Collected, since a student's day shouldn't roll
// over on the server's UTC clock.
export function ActivityHeartbeat() {
  useEffect(() => {
    const supabase = createClient();
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const today = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      supabase.rpc("record_activity_heartbeat", { p_date: today, p_seconds: INTERVAL_SECONDS });
    }, INTERVAL_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
