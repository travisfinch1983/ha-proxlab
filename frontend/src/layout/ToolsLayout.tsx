import { faServer, faStore } from "@fortawesome/free-solid-svg-icons";
import TabLayout from "./TabLayout";
import type { TabDef } from "./TabLayout";

const TABS: TabDef[] = [
  { to: "/tools", label: "Installed", icon: faServer },
  { to: "/tools/marketplace", label: "Marketplace", icon: faStore },
];

export default function ToolsLayout() {
  return <TabLayout tabs={TABS} />;
}
