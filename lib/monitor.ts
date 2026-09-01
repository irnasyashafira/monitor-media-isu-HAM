import rawConfig from "@/data/monitor-config.json";

import type { Cluster, Subcluster } from "@/lib/types";

type MonitorConfig = {
  title: string;
  subtitle: string;
  startDate: string;
  refreshHours: number;
  clusters: Cluster[];
};

export const MONITOR_CONFIG = rawConfig as MonitorConfig;
export const START_DATE = MONITOR_CONFIG.startDate;
export const REFRESH_HOURS = MONITOR_CONFIG.refreshHours;
export const CLUSTERS = MONITOR_CONFIG.clusters;
export const SUBCLUSTERS = CLUSTERS.flatMap((cluster) => cluster.subclusters);

export const CLUSTER_BY_ID = Object.fromEntries(
  CLUSTERS.map((cluster) => [cluster.id, cluster]),
) as Record<string, Cluster>;

export const SUBCLUSTER_BY_ID = Object.fromEntries(
  SUBCLUSTERS.map((subcluster) => [subcluster.id, subcluster]),
) as Record<string, Subcluster>;

export const QUERY_LOGIC_TEXT = CLUSTERS.flatMap((cluster) =>
  cluster.subclusters.map(
    (subcluster) =>
      `[${cluster.label} — ${subcluster.label}]\n${subcluster.query}`,
  ),
).join("\n\n");
