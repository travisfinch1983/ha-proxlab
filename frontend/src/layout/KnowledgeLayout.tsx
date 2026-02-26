import {
  faDatabase,
  faBrain,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import TabLayout from "./TabLayout";
import type { TabDef } from "./TabLayout";

const TABS: TabDef[] = [
  { to: "/knowledge", label: "Context", icon: faDatabase },
  { to: "/knowledge/memory", label: "Memory", icon: faBrain },
  { to: "/knowledge/vector-db", label: "Vector DB", icon: faMagnifyingGlass },
];

export default function KnowledgeLayout() {
  return <TabLayout tabs={TABS} />;
}
