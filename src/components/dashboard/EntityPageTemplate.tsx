import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { FilterBar } from "@/components/filters/FilterBar";
import { EntityDashboard } from "@/components/dashboard/EntityDashboard";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";

const ENTITY_PAGES = [
  {
    slug: "defence-minister",
    entity: "Defence Minister" as const,
    title: "Defence Minister — Media Intelligence",
  },
  {
    slug: "indian-army",
    entity: "Indian Army" as const,
    title: "Indian Army — Media Intelligence",
  },
  {
    slug: "indian-navy",
    entity: "Indian Navy" as const,
    title: "Indian Navy — Media Intelligence",
  },
  {
    slug: "indian-air-force",
    entity: "Indian Air Force" as const,
    title: "Indian Air Force — Media Intelligence",
  },
  {
    slug: "indian-coast-guard",
    entity: "Indian Coast Guard" as const,
    title: "Indian Coast Guard — Media Intelligence",
  },
];

function createEntityPage(config: (typeof ENTITY_PAGES)[number]) {
  return function EntityPage() {
    return (
      <>
        <Header
          title={config.title}
          subtitle={`Sentiment analysis and media monitoring for ${config.entity}`}
        />
        <Suspense fallback={null}>
          <FilterBar entity={config.entity} />
        </Suspense>
        <div className="p-4 sm:p-6">
          <Suspense fallback={<PageSkeleton />}>
            <EntityDashboard
              entity={config.entity}
              entitySlug={config.slug}
            />
          </Suspense>
        </div>
      </>
    );
  };
}

export const DefenceMinisterPage = createEntityPage(ENTITY_PAGES[0]);
export const IndianArmyPage = createEntityPage(ENTITY_PAGES[1]);
export const IndianNavyPage = createEntityPage(ENTITY_PAGES[2]);
export const IndianAirForcePage = createEntityPage(ENTITY_PAGES[3]);
export const IndianCoastGuardPage = createEntityPage(ENTITY_PAGES[4]);
