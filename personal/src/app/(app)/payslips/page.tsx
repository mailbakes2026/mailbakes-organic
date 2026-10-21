import { PayslipsBoard } from "@/components/payslips-board";
import { jessEmail, paulEmail } from "@/lib/env";
import { googleStatus, SetupError } from "@/lib/google";
import { detectLatestPayslips, listPayslipRuns, listStaff } from "@/lib/payslips";

export const dynamic = "force-dynamic";

export default async function PayslipsPage() {
  const google = await googleStatus();
  const staff = await listStaff();
  const runs = await listPayslipRuns();
  let preview = null;
  let previewError = "";
  if (google.connected) {
    try {
      preview = await detectLatestPayslips();
    } catch (error) {
      console.error(error);
      previewError = error instanceof SetupError ? error.message : error instanceof Error ? error.message : "The payslips email could not be read.";
    }
  }

  return (
    <PayslipsBoard
      staff={staff}
      preview={preview}
      previewError={previewError}
      runs={runs}
      driveGranted={google.driveGranted}
      connected={google.connected}
      jessEmail={jessEmail()}
      paulEmail={paulEmail()}
    />
  );
}
