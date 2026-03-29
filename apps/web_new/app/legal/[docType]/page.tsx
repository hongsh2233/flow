import { notFound } from "next/navigation";
import { LegalDocumentClient } from "./LegalDocumentClient";

const ALLOWED = new Set(["privacy", "terms"]);

export default async function LegalDocumentPage({
  params,
}: {
  params: Promise<{ docType: string }>;
}) {
  const { docType } = await params;
  if (!ALLOWED.has(docType)) {
    notFound();
  }
  return <LegalDocumentClient docType={docType as "privacy" | "terms"} />;
}
