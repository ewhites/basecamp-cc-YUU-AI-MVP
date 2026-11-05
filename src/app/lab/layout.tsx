import { redirect } from "next/navigation";
import { LabNav } from "@/components/LabNav";
import { getViewer } from "@/lib/session";

const NAV: Record<string, { href: string; label: string }[]> = {
  student: [
    { href: "/lab", label: "My Lab" },
    { href: "/lab/prompt-studio", label: "Prompt Studio" },
    { href: "/lab/model-arena", label: "Model Arena" },
    { href: "/lab/agent-builder", label: "Agent Builder" },
    { href: "/lab/portfolio", label: "Skills portfolio" },
    { href: "/lab/security-check", label: "Security check" },
  ],
  instructor: [
    { href: "/lab/instructor", label: "Instructor console" },
    { href: "/lab/security-check", label: "Security check" },
  ],
  curriculum: [
    { href: "/lab/curriculum", label: "Curriculum insights" },
    { href: "/lab/security-check", label: "Security check" },
  ],
  admin: [
    { href: "/lab/admin", label: "Admin and security" },
    { href: "/lab/security-check", label: "Security check" },
  ],
};

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v) redirect("/");
  const roleLabel = { student: "Student", instructor: "Instructor", curriculum: "Curriculum", admin: "Admin" }[v.role];
  return (
    <>
      <LabNav links={NAV[v.role] ?? []} user={{ name: v.name, role: roleLabel }} />
      <main className="page">{children}</main>
    </>
  );
}

