import {
  faBell,
  faClock,
  faLink,
  faDiagramProject,
} from "@fortawesome/free-solid-svg-icons";
import TabLayout from "./TabLayout";
import type { TabDef } from "./TabLayout";

const TABS: TabDef[] = [
  { to: "/automations", label: "Subscriptions", icon: faBell },
  { to: "/automations/schedules", label: "Schedules", icon: faClock },
  { to: "/automations/chains", label: "Chains", icon: faLink },
  { to: "/automations/builder", label: "Builder", icon: faDiagramProject },
];

export default function AutomationsLayout() {
  return <TabLayout tabs={TABS} />;
}
