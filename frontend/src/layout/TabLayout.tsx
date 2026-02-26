import { NavLink, Outlet } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export interface TabDef {
  to: string;
  label: string;
  icon: IconDefinition;
}

interface Props {
  tabs: TabDef[];
}

export default function TabLayout({ tabs }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Tab strip */}
      <div className="flex items-center gap-1 px-4 pt-2 pb-0 bg-base-100 border-b border-base-300">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-primary bg-base-200"
                  : "border-transparent text-base-content/60 hover:text-base-content hover:bg-base-200/50"
              }`
            }
          >
            <FontAwesomeIcon icon={tab.icon} className="w-4 h-4" />
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Sub-page content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
