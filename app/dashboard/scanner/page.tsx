import { requireProfile } from "@/lib/auth";
import { ScannerClient } from "@/components/ScannerClient";

export default async function ScannerPage() {
  await requireProfile(["scanner","admin","regcom"]);
  return <ScannerClient />;
}
