export type Article = {
  id: string;
  publishedAt: string;
  title: string;
  source: string;
  link: string;
  description: string;
  primaryCluster: string;
  clusterIds: string[];
  primarySubcluster: string;
  subclusterIds: string[];
  matchedQueries: string[];
  collectedAt: string;
  reviewStatus: string;
  humanVerified: boolean;
  reviewNote: string;
};

export type NewsMeta = {
  generatedAt: string;
  lastRunAt: string;
  startDate: string;
  refreshHours: number;
  mode: "full" | "incremental" | "seed";
  feedsOk: number;
  feedsFailed: number;
  totalStored: number;
  totalPublished: number;
  newArticles: number;
  warning?: string;
};

export type Subcluster = {
  id: string;
  label: string;
  shortLabel: string;
  query: string;
};

export type Cluster = {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  subclusters: Subcluster[];
};

export type NewsPayload = {
  meta: NewsMeta;
  clusters: Cluster[];
  articles: Article[];
};
