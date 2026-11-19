import Image from "next/image";
import Link from "next/link";
import { AccountMenu, type AccountUser } from "./AccountMenu";

/**
 * The top bar: the Year Up United logo on its cream tile (once, unaltered), "AI Lab", the plain sample note,
 * and the initials button that opens the one menu (name and role, How it works, sign out).
 */
export function TopBar({ user, home = "/lab" }: { user: AccountUser; home?: string }) {
  return (
    <header className="ds-topbar">
      <div className="ds-topbar-in">
        <Link href={home} className="ds-brand" aria-label="AI Lab home">
          <span className="ds-logo ds-sq">
            <Image src="/year-up-united.png" alt="Year Up United" width={85} height={28} priority />
          </span>
          <span className="ds-name">AI Lab</span>
        </Link>
        <span className="ds-gap" />
        <span className="ds-sample">Sample data</span>
        <AccountMenu user={user} />
      </div>
    </header>
  );
}
