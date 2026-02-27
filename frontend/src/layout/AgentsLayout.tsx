import { faRobot, faAddressCard } from "@fortawesome/free-solid-svg-icons";
import TabLayout from "./TabLayout";
import type { TabDef } from "./TabLayout";

const TABS: TabDef[] = [
  { to: "/agents", label: "Agents", icon: faRobot },
  { to: "/agents/profiles", label: "Profiles", icon: faAddressCard },
];

export default function AgentsLayout() {
  return <TabLayout tabs={TABS} />;
}
