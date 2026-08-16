import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your account — Narrative Lens" },
      { name: "description", content: "Manage your Narrative Lens account." },
      { property: "og:title", content: "Your account — Narrative Lens" },
      { property: "og:description", content: "Manage your Narrative Lens account." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setCreatedAt(data.user?.created_at ?? null);
    });
    import("@/lib/narrative-data").then(({ fetchSampleEventId }) => {
      fetchSampleEventId()
        .then((id) => setSampleId(id))
        .catch(console.error);
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="eyebrow">Your desk</p>
      <h1 className="headline mt-3 text-5xl">Account</h1>

      <div className="mt-10 paper-card divide-y divide-rule">
        <div className="grid grid-cols-3 gap-4 p-6">
          <span className="eyebrow">Email</span>
          <span className="col-span-2 font-serif">{email ?? "—"}</span>
        </div>
        <div className="grid grid-cols-3 gap-4 p-6">
          <span className="eyebrow">Joined</span>
          <span className="col-span-2 font-serif">
            {createdAt ? new Date(createdAt).toLocaleDateString() : "—"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 p-6">
          <span className="eyebrow">Plan</span>
          <span className="col-span-2 font-serif">Reader (free)</span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {sampleId ? (
          <Link
            to="/dashboard/$eventId"
            params={{ eventId: sampleId }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-accent"
          >
            Open sample dashboard
          </Link>
        ) : null}
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-md border border-rule px-5 py-3 text-sm font-medium hover:bg-secondary"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
