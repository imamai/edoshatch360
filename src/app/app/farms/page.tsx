import type { Metadata } from "next";
import { Bird, Home, MapPin } from "lucide-react";

import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { getFlocks, getHouses } from "@/lib/data/flocks";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ComparisonBars } from "@/components/charts/trend-charts";
import { NewFarmForm, NewHouseForm } from "./farm-forms";
import { FarmCard } from "./farm-card";
import { formatNumber } from "@/lib/utils";
import type { FarmHealth } from "@/lib/database.types";

export const metadata: Metadata = { title: "Farms & houses" };

export default async function FarmsPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const canManage = can(session.role, CAN_WRITE);

  // Archived houses ride along too, with their own badge and a restore
  // button — the "add flock" house picker asks for active ones only.
  const [houses, flocks] = await Promise.all([
    getHouses(session.tenant.id, true),
    getFlocks(session.tenant.id),
  ]);

  // Health score per farm, from the same Postgres function used everywhere.
  const healths = await Promise.all(
    session.farms.map(async (farm) => {
      const { data } = await supabase.rpc("edoshatch360_farm_health", { p_farm: farm.id });
      return { farmId: farm.id, health: data as FarmHealth | null };
    }),
  );
  const healthByFarm = new Map(healths.map((h) => [h.farmId, h.health]));

  const totalBirds = flocks.reduce((a, f) => a + f.current_count, 0);

  const birdsByFarm = session.farms
    .map((farm) => ({
      name: farm.name,
      value: flocks
        .filter((f) => f.farm_id === farm.id)
        .reduce((a, f) => a + f.current_count, 0),
    }))
    .filter((d) => d.value > 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Farms &amp; houses
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            The physical shape of your operation — sites, sheds and what is in them.
          </p>
        </div>
        <NewFarmForm />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Farms"
          value={session.farms.length}
          icon={<MapPin className="h-4.5 w-4.5" />}
          tone="brand"
        />
        <StatCard
          label="Houses"
          value={houses.length}
          icon={<Home className="h-4.5 w-4.5" />}
          tone="info"
        />
        <StatCard
          label="Active flocks"
          value={flocks.length}
          icon={<Bird className="h-4.5 w-4.5" />}
          tone="good"
        />
        <StatCard
          label="Total birds"
          value={formatNumber(totalBirds)}
          icon={<Bird className="h-4.5 w-4.5" />}
          tone="brand"
        />
      </div>

      {session.farms.length > 1 && birdsByFarm.length > 0 && (
        <Card>
          <CardHeader
            title="Birds by farm"
            subtitle="Where your flock actually sits"
            icon={<MapPin className="h-4 w-4" />}
          />
          <CardBody>
            <ComparisonBars data={birdsByFarm} unitLabel="birds" />
          </CardBody>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          {session.farms.map((farm) => (
            <FarmCard
              key={farm.id}
              farm={farm}
              houses={houses.filter((h) => h.farm_id === farm.id)}
              flocks={flocks.filter((f) => f.farm_id === farm.id)}
              health={healthByFarm.get(farm.id) ?? null}
              canManage={canManage}
            />
          ))}

          {session.farms.length === 0 && (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<MapPin className="h-6 w-6" />}
                  title="No farms yet"
                  description="Add a farm and then the houses on it, so every flock has a place it actually lives."
                />
              </CardBody>
            </Card>
          )}
        </div>

        <NewHouseForm farms={session.farms} />
      </div>
    </div>
  );
}
