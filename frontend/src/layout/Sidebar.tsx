import { NavLink } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouseChimneyUser,
  faPlug,
  faRobot,
  faDatabase,
  faBrain,
  faMagnifyingGlass,
  faCogs,
  faBug,
  faAnglesLeft,
  faAnglesRight,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useStore } from "../store";

interface NavItem {
  to: string;
  icon: IconDefinition;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", icon: faHouseChimneyUser, label: "Dashboard" },
  { to: "/connections", icon: faPlug, label: "Connections" },
  { to: "/agents", icon: faRobot, label: "Agents" },
  { to: "/context", icon: faDatabase, label: "Context" },
  { to: "/memory", icon: faBrain, label: "Memory" },
  { to: "/vector-db", icon: faMagnifyingGlass, label: "Vector DB" },
  { to: "/settings", icon: faCogs, label: "Settings" },
  { to: "/debug", icon: faBug, label: "Debug" },
];

export default function Sidebar() {
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggle = useStore((s) => s.toggleSidebar);

  return (
    <aside
      className={`flex flex-col bg-base-100 border-r border-base-300 transition-all duration-200 ${
        collapsed ? "sidebar-collapsed" : "sidebar-expanded"
      }`}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-base-300">
        <span className="text-2xl">🤖</span>
        {!collapsed && (
          <span className="font-bold text-lg text-primary">ProxLab</span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-2">
        <ul className="menu menu-sm gap-1 px-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-content"
                      : "hover:bg-base-200"
                  }`
                }
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className="w-5 h-5 shrink-0"
                  fixedWidth
                />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className="btn btn-ghost btn-sm m-2"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <FontAwesomeIcon icon={collapsed ? faAnglesRight : faAnglesLeft} />
      </button>
    </aside>
  );
}
