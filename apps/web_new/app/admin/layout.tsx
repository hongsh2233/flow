import AdminKiwoomShell from "./AdminKiwoomShell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminKiwoomShell>{children}</AdminKiwoomShell>;
}
