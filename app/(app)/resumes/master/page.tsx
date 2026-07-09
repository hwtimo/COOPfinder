import { MasterProfileClient } from "./master-profile-client";
import { mockMasterResume, mockStudentProfile } from "@/lib/mock";

export default function MasterProfilePage() {
  return (
    <MasterProfileClient
      profile={mockStudentProfile}
      masterResume={mockMasterResume}
    />
  );
}
