import { createClient } from "@/lib/supabase/server";
import { ActivityHeartbeat } from "@/components/ActivityHeartbeat";

export default async function DashboardLayout(props: LayoutProps<"/dashboard">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      {user ? <ActivityHeartbeat /> : null}
      {props.children}
    </>
  );
}
