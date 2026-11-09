import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/account/ProfileForm";
import { SignOutForm } from "@/components/account/SignOutForm";
import { FormAlert } from "@/components/auth/fields";
import { STATUS_MESSAGES } from "@/lib/auth/messages";
import { getLiveCustomer } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Your account" };
// Always per request: it depends on who's signed in. (Without this, a build with no Supabase settings would pre-render
// the "unavailable" redirect.)
export const dynamic = "force-dynamic";

/** The columns of public.profiles this page reads (supabase/migrations/20261108200000_customer_profiles.sql). */
type Profile = { full_name: string; email: string | null; avatar_url: string | null; phone: string | null; created_at: string };

// The signed-in customer's own page. proxy.ts has already refreshed the session, but this page checks it again with
// getLiveCustomer(): getUser(), which asks Supabase Auth, then the database's check that this session is still live
// (DEF-6). It reads the profile through RLS as the customer, so it can only ever be theirs.
// It's rendered per request and never cached (src/lib/cache-policy.ts). Being a customer grants nothing in admin.
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const check = await getLiveCustomer();
  if (check.status !== "live") {
    // A session that has ended (revoked, signed out elsewhere, or ended after refresh-token reuse) has its cookies cleared.
    return redirect(check.status === "unavailable" ? "/auth/login?error=unavailable" : check.status === "ended" ? "/auth/session-ended" : "/auth/login?next=/account");
  }
  const { supabase, user } = check.customer;

  const { data, error: profileError } = await supabase.from("profiles").select("full_name, email, avatar_url, phone, created_at").eq("id", user.id).maybeSingle();
  const profile = data as Profile | null;
  const profileUnavailable = profileError !== null || profile === null;
  const { status } = await searchParams;
  const message = status === "saved" ? undefined : STATUS_MESSAGES[status ?? ""];
  const name = profile?.full_name || "";
  const email = profile?.email ?? user.email ?? "";
  const since = new Date(profile?.created_at ?? user.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const initials = (name || email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const viaGoogle = user.identities?.some((i) => i.provider === "google");

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      {message && <div className="mb-8"><FormAlert tone="info">{message}</FormAlert></div>}
      <div className="flex items-center gap-5">
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" width={64} height={64} referrerPolicy="no-referrer" className="size-16 rounded-full bg-cream object-cover" />
        ) : (
          <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-cream font-serif text-2xl text-espresso ring-1 ring-gold">{initials || "N"}</span>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">Your account</p>
          <h1 className="mt-1 truncate font-serif text-title font-medium leading-[1.05]">{name ? `Hello, ${name.split(" ")[0]}` : "Hello"}</h1>
        </div>
      </div>

      <dl className="mt-10 grid gap-x-8 gap-y-5 border-y border-line py-6 text-sm sm:grid-cols-2">
        <div><dt className="text-ink-soft">Email</dt><dd className="mt-1 break-all font-medium">{email}</dd></div>
        <div><dt className="text-ink-soft">Member since</dt><dd className="mt-1 font-medium">{since}</dd></div>
        <div><dt className="text-ink-soft">Signs in with</dt><dd className="mt-1 font-medium">{[user.identities?.some((i) => i.provider === "email") && "Email and password", viaGoogle && "Google"].filter(Boolean).join(" and ") || "Email and password"}</dd></div>
      </dl>

      <section aria-labelledby="details-title" className="mt-10">
        <h2 id="details-title" className="font-serif text-heading font-medium">Your details</h2>
        <div className="mt-5">
          {profileUnavailable
            ? <FormAlert tone="error">Unable to load your profile details. Please try again later.</FormAlert>
            : <ProfileForm fullName={name} phone={profile.phone ?? ""} />}
        </div>
      </section>

      <section aria-labelledby="orders-title" className="mt-12">
        <h2 id="orders-title" className="font-serif text-heading font-medium">Orders</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">Your orders will appear here once ordering opens.</p>
      </section>

      <SignOutForm />
    </main>
  );
}
