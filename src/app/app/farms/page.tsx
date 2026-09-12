import type { Metadata } from "next";
import Link from "next/link";
import { Bird, Home, MapPin } from "lucide-react";

import { requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { getFlocks, getHouses } from "@/lib/data/flocks";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, type Tone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ComparisonBars } from "@/components/charts/trend-charts";
import { NewFarmForm, NewHouseForm } from "./farm-forms";
import { formatNumber } from "@/lib/utils";
import type { FarmHealth } from "@/lib/database.types";

export const metadata: Metadata = { title: "Farms & houses" };

const BAND_TONE: Record<FarmHealth["band"], Tone> = {
  excellent: "good",
  good: "brand",
  attention: "attention",
  critical: "critical",
  unknown: "neutral",
};

export default async function FarmsPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [houses, flocks] = await Promise.all([
    getHouses(session.tenant.id),
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
          {session.farms.map((farm) => {
            const farmHouses = houses.filter((h) => h.farm_id === farm.id);
            const farmFlocks = flocks.filter((f) => f.farm_id === farm.id);
            const health = healthByFarm.get(farm.id);
            const birds = farmFlocks.reduce((a, f) => a + f.current_count, 0);

            return (
              <Card key={farm.id}>
                <CardHeader
                  title={farm.name}
                  subtitle={
                    [farm.location, farm.county].filter(Boolean).join(" · ") || "No location set"
                  }
                  icon={<MapPin className="h-4 w-4" />}
                  action={
                    health && (
                      <Badge tone={BAND_TONE[health.band]} dot>
                        {health.score !== null ? `${health.score} / 100` : "No score yet"}
                      </Badge>
                    )
                  }
                />
                <CardBody className="p-0">
                  <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
                    {[
                      ["Houses", farmHouses.length],
                      ["Flocks", farmFlocks.length],
                      ["Birds", formatNumber(birds)],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="px-4 py-3 text-center">
                        <p className="text-lg font-semibold text-ink tnum">{value}</p>
                        <p className="text-xs text-ink-faint">{label}</p>
                      </div>
                    ))}
                  </div>

                  {farmHouses.length === 0 ? (
                    <p className="px-5 py-5 text-center text-sm text-ink-faint">
                      No houses recorded on this farm yet. Add one alongside to organise your
                      flocks by shed.
                    </p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {farmHouses.map((house) => {
                        const inHouse = farmFlocks.filter((f) => f.house_id === house.id);
                        const housed = inHouse.reduce((a, f) => a + f.current_count, 0);
                        const full =
                          house.capacity && house.capacity > 0
                            ? housed / house.capacity
                            : null;

                        return (
                          <li
                            key={house.id}
                            className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink">
                                {house.name}
                                {house.code ? ` · ${house.code}` : ""}
                              </p>
                              <p className="text-xs text-ink-faint">
                                {inHouse.length > 0
                                  ? inHouse.map((f) => f.code).join(", ")
                                  : "Empty"}
                                {house.house_type
                                  ? ` · ${house.house_type.replace(/_/g, " ")}`
                                  : ""}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold text-ink tnum">
                                {formatNumber(housed)}
                                {house.capacity ? (
                                  <span className="font-normal text-ink-faint">
                                    {" "}
                                    / {formatNumber(house.capacity)}
                                  </span>
                                ) : null}
                              </p>
                              {full !== null && (
                                <p
                                  className={`text-xs tnum ${
                                    full > 1 ? "text-critical" : "text-ink-faint"
                                  }`}
                                >
                                  {Math.round(full * 100)}% full
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {farmFlocks.length > 0 && (
                    <div className="border-t border-line px-4 py-3 sm:px-5">
                      <p className="mb-2 text-xs font-semibold text-ink-faint">Flocks here</p>
                      <div className="flex flex-wrap gap-1.5">
                        {farmFlocks.map((f) => (
                          <Link
                            key={f.id}
                            href={`/app/flocks/${f.id}`}
                            className="rounded-full border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-brand hover:text-brand"
                          >
                            {f.code}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}

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
