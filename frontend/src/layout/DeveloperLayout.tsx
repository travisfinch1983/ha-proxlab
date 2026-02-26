import {
  faBug,
  faChartColumn,
  faChartPie,
  faListCheck,
  faMap,
} from "@fortawesome/free-solid-svg-icons";
import TabLayout from "./TabLayout";
import type { TabDef } from "./TabLayout";

const TABS: TabDef[] = [
  { to: "/developer", label: "Debug", icon: faBug },
  { to: "/developer/api-info", label: "API Info", icon: faChartColumn },
  { to: "/developer/reports", label: "Reports", icon: faChartPie },
  { to: "/developer/issues", label: "Issues", icon: faListCheck },
  { to: "/developer/roadmap", label: "Roadmap", icon: faMap },
];

export default function DeveloperLayout() {
  return <TabLayout tabs={TABS} />;
}
